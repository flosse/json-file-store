/*
Copyright (C) 2012 - 2016 Markus Kohlhase <mail@markus-kohlhase.de>
 */

import async  from 'async';
import fs     from 'fs';
import path   from 'path';
import uuid   from 'node-uuid';
import mkdirp from 'mkdirp';
import clone  from 'clone';

const isJSONFile = f => f.substr(-5) === ".json";

const removeFileExtension = f => f.split(".json")[0];

const getIDs = a => a.filter(isJSONFile).map(removeFileExtension);

const readIDsSync = d => getIDs(fs.readdirSync(d));

const readIDs = (d, cb) => fs.readdir(d, (err, ids) =>
  cb(err, getIDs(ids))
);

const getObjectFromFileSync = function(id) {
  try {
    return JSON.parse(fs.readFileSync(this._getFileName(id), "utf8"));
  } catch (error) {
    return error;
  }
};

const getObjectFromFile = function(id, cb) {
  fs.readFile(this._getFileName(id), "utf8", (err, o) => {
    if (err) {
      return cb(err);
    }
    try {
      cb(null, JSON.parse(o));
    } catch (error) {
      cb(error);
    }
  });
};

const FILE_EXISTS = fs.constants ? fs.constants.F_OK : fs.F_OK;
const FILE_IS_WRITABLE = fs.constants ? fs.constants.W_OK : fs.W_OK;

const canWriteToFile = (file, cb) => {
  fs.access(file, FILE_EXISTS, (err) => {
    if (err) return cb(null);
    fs.access(file, FILE_IS_WRITABLE, cb);
  });
};

const canWriteToFileSync = (file) => {
  try {
    fs.accessSync(file, FILE_EXISTS);
  } catch (err) {
    return;
  }

  fs.accessSync(file, FILE_IS_WRITABLE);
};

const saveObjectToFile = function(o, file, cb) {
  const indent = this._pretty ? 2 : void 0;
  let json;
  try {
    json = JSON.stringify(o, null, indent);
  } catch (error) {
    if (cb != null) {
      return cb(error);
    } else {
      return error;
    }
  }

  const tmpFileName = file + uuid.v4() + ".tmp";

  if (cb != null) {
    canWriteToFile(file, (err) => {
      if (err) return cb(err);

      fs.writeFile(tmpFileName, json, 'utf8', (err) => {
        if (err) return cb(err);

        fs.rename(tmpFileName, file, cb);
      });
    });
  } else {
    try {
      canWriteToFileSync(file);
      fs.writeFileSync(tmpFileName, json, 'utf8');
      fs.renameSync(tmpFileName, file);
    } catch (error) {
      return error;
    }
  }
};

const id2fileName = (id, dir) => path.join(dir, id + ".json");

const save = function(id, o, cb) {
  let backup, k;
  if (typeof id === "object") {
    cb = o;
    o = id;
    id = null;
  }
  if (id == null) {
    id = uuid.v4();
  }
  const file = this._getFileName(id);
  o = clone(o);
  if (this._saveId) {
    if ((typeof (k = this._saveId)) === 'string' && k.length > 0) {
      o[k] = id;
    } else {
      o.id = id;
    }
  }

  const data = this._single ? (backup = this._cache[id], this._cache[id] = o, this._cache) : o;

  const done = (function(_this) {
    return (err) => {
      if (err) {
        if (_this._single) {
          _this._cache[id] = backup;
        }
        if (cb != null) {
          cb(err);
        } else {
          return err;
        }
      } else {
        _this._cache[id] = o;
        if (cb != null) {
          cb(null, id);
        } else {
          return id;
        }
      }
    };
  })(this);

  if (this._memory) return done();

  if (cb != null) {
    saveObjectToFile.call(this, data, file, done);
  } else {
    return done(saveObjectToFile.call(this, data, file));
  }
};

const get = function(id, cb) {
  let o = clone(this._cache[id]);
  if (o != null) {
    return (cb != null ? cb(null, o) : o);
  }
  const done = ((_this) => {
    return (err, o) => {
      let e, item;
      if (err) {
        const e = new Error("could not load data");
        if (cb != null) {
          return cb(e);
        } else {
          return e;
        }
      }
      item = _this._single ? o[id] : o;
      if (item == null) {
        e = new Error("could not load data");
        if (cb != null) {
          return cb(e);
        } else {
          return e;
        }
      }
      _this._cache[id] = item;
      if (cb != null) {
        return cb(null, item);
      } else {
        return item;
      }
    };
  })(this);

  if (this._memory) return done(null, o);

  if (cb != null) return getObjectFromFile.call(this, id, done);

  const err = (o = getObjectFromFileSync.call(this, id)) instanceof Error;

  return done((err ? o : void 0), (!err ? o : void 0));
};

const remove = function(id, cb) {
  let e, err, notInCache, o;
  const file = this._getFileName(id);
  const cacheBackup = this._cache[id];
  if (cacheBackup == null) {
    notInCache = new Error(id + " does not exist");
  }
  const done = ((_this) => {
    return (err) => {
      if (err) {
        _this._cache[id] = cacheBackup;
        return (cb != null ? cb(err) : err);
      }
      delete _this._cache[id];
      return typeof cb === "function" ? cb() : void 0;
    };
  })(this);

  if (this._single) {
    delete this._cache[id];
    if (this._memory || (notInCache != null)) {
      return done(notInCache);
    }

    if (cb != null) {
      return saveObjectToFile.call(this, this._cache, file, done);
    }

    err = (o = saveObjectToFile.call(this, this._cache, file)) instanceof Error;
    return done((err ? o : void 0), (!err ? o : void 0));
  }

  if (this._memory) return done(notInCache);

  if (cb != null) return fs.unlink(file, done);

  try {
    return done(fs.unlinkSync(file));
  } catch (error) {
    return done(error);
  }
};

class Store {

  constructor(name = 'store', opt = {}) {

    this.name = name;
    this._single = opt.single === true || opt.type === 'single';
    this._pretty = opt.pretty === true;
    this._memory = opt.memory === true || opt.type === 'memory';
    this._saveId = opt.saveId;

    if (isJSONFile(this.name)) {
      this.name = this.name.split(".json")[0];
      this._single = true;
    }

    this._dir = path.resolve(this.name);

    if (this._single) {
      this._dir = path.dirname(this._dir);
    }

    this._cache = {};

    if (!this._memory) {
      mkdirp.sync(this._dir);
    }

    if (this._single) {
      if (!this._memory) {
        const fn = this._getFileName();
        if (!fs.existsSync(fn)) {
          if (fs.writeFileSync(fn, "{}", 'utf8')) {
            throw new Error("could not create database");
          }
        }
      }
      this._cache = this.allSync();
    }
  }

  _getFileName(id) {
    if (this._single) {
      return path.join(this._dir, (path.basename(this.name)) + ".json");
    } else {
      return id2fileName(id, this._dir);
    }
  }

  save(id, o, cb) {
    if (cb == null) {
      cb = () => {};
    }
    return save.call(this, id, o, cb);
  }

  saveSync(id, o) {
    return save.call(this, id, o);
  }

  get(id, cb) {
    if (cb == null) {
      cb = () => {};
    }
    get.call(this, id, cb);
  }

  getSync(id) {
    return get.call(this, id);
  }

  delete(id, cb) {
    remove.call(this, id, cb);
  }

  deleteSync(id) {
    return remove.call(this, id);
  }

  all(cb) {

    if (cb == null) cb = () => {};

    if (this._memory) return cb(null, this._cache);

    if (this._single) {
      return getObjectFromFile.call(this, void 0, cb);
    }
    readIDs(this._dir, ((that) => {
      return (err, ids) => {
        if (typeof err !== "undefined" && err !== null) {
          return cb(err);
        }

        let all = {};

        const loaders = (() => {
          let i, len;
          let results = [];
          for (i = 0, len = ids.length; i < len; i++) {
            const id = ids[i];
            results.push(((id) =>
              (cb) => that.get(id, (err, o) => {
                  if (!err) {
                    all[id] = o;
                  }
                  return cb(err);
                })
            )(id));
          }
          return results;
        })();

        async.parallel(loaders, (err) => cb(err, all));

      };
    })(this));
  }

  allSync() {

    if (this._memory) return this._cache;

    if (this._single) {
      const db = getObjectFromFileSync.apply(this);
      if (typeof db !== "object") {
        throw new Error("could not load database");
      }
      return db;
    }

    let objects = {};
    readIDsSync(this._dir).forEach((f) => {
      const item = getObjectFromFileSync.call(this, f);
      if (item != null) {
        objects[f] = item;
      } else {
        console.error("could not load '" + f + "'");
      }
    });

    return objects;
  }

}

module.exports = Store;
