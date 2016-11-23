/*
Copyright (C) 2012 - 2016 Markus Kohlhase <mail@markus-kohlhase.de>
 */

import async  from 'async';
import fs     from 'fs';
import path   from 'path';
import uuid   from 'uuid';
import mkdirp from 'mkdirp';
import clone  from 'clone';

const isJSONFile = f => f.substr(-5) === ".json";
const removeFileExtension = f => f.split(".json")[0];
const getIDs = a => a.filter(isJSONFile).map(removeFileExtension);
const readIDsSync = d => getIDs(fs.readdirSync(d));
const readIDs = (d, cb) => fs.readdir(d, (err, ids) => cb(err, getIDs(ids)));

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
    if (typeof cb === "function") {
      return cb(error);
    } else {
      return error;
    }
  }

  const tmpFileName = file + uuid.v4() + ".tmp";

  if (typeof cb === "function") {
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
  let backup, k, data;
  if (typeof id === "object") {
    cb = o;
    o = id;
    id = null;
  }
  if (typeof id !== "string") {
    id = this._idGenerator();
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

  if (this._single) {
    backup = this._cache[id];
    this._cache[id] = o;
    data = this._cache;
  } else {
    data = o;
  }

  const done = function(err) {
    if (err) {
      if (this._single) {
        this._cache[id] = backup;
      }
      if (typeof cb === "function") {
        cb(err);
      } else {
        return err;
      }
    } else {
      this._cache[id] = o;
      if (typeof cb === "function") {
        cb(null, id);
      } else {
        return id;
      }
    }
  };


  if (this._memory) return done.call(this);

  if (typeof cb === "function") {
    saveObjectToFile.call(this, data, file, done.bind(this));
  } else {
    return done.call(this, saveObjectToFile.call(this, data, file));
  }
};

const get = function(id, cb) {
  let o = clone(this._cache[id]);
  if (typeof o === "object") {
    return (typeof cb === "function" ? cb(null, o) : o);
  }
  const done = function (err, o) {
    let e, item;
    if (err) {
      const e = new Error("could not load data");
      if (typeof cb === "function") {
        return cb(e);
      } else {
        return e;
      }
    }
    item = this._single ? o[id] : o;
    if (typeof item !== "object") {
      e = new Error("could not load data");
      if (typeof cb === "function") {
        return cb(e);
      } else {
        return e;
      }
    }
    this._cache[id] = item;
    if (typeof cb === "function") {
      return cb(null, item);
    } else {
      return item;
    }
  };

  if (this._memory) return done.call(this, null, o);

  if (typeof cb === "function") return getObjectFromFile.call(this, id, done.bind(this));

  const err = (o = getObjectFromFileSync.call(this, id)) instanceof Error;

  return done.call(this, (err ? o : void 0), (!err ? o : void 0));
};

const remove = function(id, cb) {
  let e, err, notInCache, o;
  const file = this._getFileName(id);
  const cacheBackup = this._cache[id];
  if (typeof cacheBackup !== "object") {
    notInCache = new Error(id + " does not exist");
  }
  const done = function (err) {
    if (err) {
      this._cache[id] = cacheBackup;
      return (typeof cb === "function" ? cb(err) : err);
    }
    delete this._cache[id];
    return typeof cb === "function" ? cb() : void 0;
  };

  if (this._single) {
    delete this._cache[id];
    if (this._memory || (notInCache !== undefined)) {
      return done.call(this, notInCache);
    }

    if (typeof cb === "function") {
      return saveObjectToFile.call(this, this._cache, file, done.bind(this));
    }

    err = (o = saveObjectToFile.call(this, this._cache, file)) instanceof Error;
    return done.call(this, (err ? o : void 0), (!err ? o : void 0));
  }

  if (this._memory) return done.call(this, notInCache);

  if (typeof cb === "function") return fs.unlink(file, done.bind(this));

  try {
    return done.call(this, fs.unlinkSync(file));
  } catch (error) {
    return done.call(this, error);
  }
};

class Store {

  constructor(name = 'store', opt = {}) {

    this.name = name;
    this._single = opt.single === true || opt.type === 'single';
    this._pretty = opt.pretty === true;
    this._memory = opt.memory === true || opt.type === 'memory';
    this._saveId = opt.saveId;
    this._idGenerator = typeof opt.idGenerator === "function" ? opt.idGenerator : uuid.v4;

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

  save(id, o, cb = () => {}) {
    return save.call(this, id, o, cb);
  }

  saveSync(id, o) {
    return save.call(this, id, o);
  }

  get(id, cb = () => {}) {
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

  all(cb = () => {}) {

    if (this._memory) return cb(null, this._cache);

    if (this._single) {
      return getObjectFromFile.call(this, void 0, cb);
    }
    readIDs(this._dir, function (err, ids) {
      if (typeof err !== "undefined" && err !== null) {
        return cb(err);
      }

      let all = {};
      const loaders = ids.map((id) => {
        return function (cb) {
          return this.get(id, (err, o) => {
            if (!err) {
              all[id] = o;
            }
            return cb(err);
          });
        }.bind(this);
      });

      async.parallel(loaders, (err) => cb(err, all));

    }.bind(this));
  }

  allSync() {

    if (this._memory) return this._cache;

    if (this._single) {
      const db = getObjectFromFileSync.call(this);
      if (typeof db !== "object") {
        throw new Error("could not load database");
      }
      return db;
    }

    let objects = {};
    readIDsSync(this._dir).forEach((f) => {
      const item = getObjectFromFileSync.call(this, f);
      if (item !== undefined) {
        objects[f] = item;
      } else {
        console.error("could not load '" + f + "'");
      }
    });

    return objects;
  }

}

module.exports = Store;
