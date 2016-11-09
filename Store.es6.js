/*
Copyright (C) 2012 - 2016 Markus Kohlhase <mail@markus-kohlhase.de>
 */

"use strict";

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

const readIDs = (d, cb) => fs.readdir(d, (err, ids) => {
  cb(err, getIDs(ids));
});

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

const canWriteToFile = (file, cb) => {
  fs.access(file, fs.constants.F_OK, (err) => {
    if (err) {
      return cb(null);
    }

    fs.access(file, fs.constants.W_OK, cb);
  });
};

const canWriteToFileSync = (file) => {
  try {
    fs.accessSync(file, fs.constants.F_OK);
  } catch (err) {
    return;
  }

  fs.accessSync(file, fs.constants.W_OK);
};

const saveObjectToFile = function(o, file, cb) {
  var json;
  const indent = this._pretty ? 2 : void 0;
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
      if (err) {
        return cb(err);
      }

      fs.writeFile(tmpFileName, json, 'utf8', (err) => {
        if (err) {
          return cb(err);
        }

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
  var backup, k;
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

  if (this._memory) {
    return done();
  } else {
    if (cb != null) {
      saveObjectToFile.call(this, data, file, done);
    } else {
      return done(saveObjectToFile.call(this, data, file));
    }
  }
};

const get = function(id, cb) {
  var err, o;
  o = clone(this._cache[id]);
  if (o != null) {
    return (cb != null ? cb(null, o) : o);
  }
  const done = (function(_this) {
    return function(err, o) {
      var e, item;
      if (err) {
        e = new Error("could not load data");
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
  if (this._memory) {
    return done(null, o);
  }
  if (cb != null) {
    return getObjectFromFile.call(this, id, done);
  }
  err = (o = getObjectFromFileSync.call(this, id)) instanceof Error;
  return done((err ? o : void 0), (!err ? o : void 0));
};

const remove = function(id, cb) {
  var cacheBackup, e, err, notInCache, o;
  const file = this._getFileName(id);
  cacheBackup = this._cache[id];
  if (cacheBackup == null) {
    notInCache = new Error(id + " does not exist");
  }
  const done = (function(_this) {
    return function(err) {
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
  } else {
    if (this._memory) {
      return done(notInCache);
    }
    if (cb != null) {
      return fs.unlink(file, done);
    }
    try {
      return done(fs.unlinkSync(file));
    } catch (error) {
      e = error;
      return done(e);
    }
  }
};

class Store {

  constructor(name, opt) {
    this.name = name != null ? name : 'store';
    if (opt == null) {
      opt = {};
    }
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
      const fn = this._getFileName();
      if (!this._memory) {
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
      cb = function() {};
    }
    return save.call(this, id, o, cb);
  };

  saveSync(id, o) {
    return save.call(this, id, o);
  };

  get(id, cb) {
    if (cb == null) {
      cb = function() {};
    }
    return get.call(this, id, cb);
  };

  getSync(id) {
    return get.call(this, id);
  };

  delete(id, cb) {
    return remove.call(this, id, cb);
  };

  deleteSync(id) {
    return remove.call(this, id);
  };

  all(cb) {
    if (cb == null) {
      cb = function() {};
    }
    if (this._memory) {
      return cb(null, this._cache);
    } else if (this._single) {
      return getObjectFromFile.call(this, void 0, cb);
    } else {
      return readIDs(this._dir, (function(_this) {
        return function(err, ids) {
          var all, id, loaders, that;
          if (typeof er !== "undefined" && er !== null) {
            return cb(err);
          }
          that = _this;
          all = {};
          loaders = (function() {
            var i, len, results;
            results = [];
            for (i = 0, len = ids.length; i < len; i++) {
              id = ids[i];
              results.push((function(id) {
                return function(cb) {
                  return that.get(id, function(err, o) {
                    if (!err) {
                      all[id] = o;
                    }
                    return cb(err);
                  });
                };
              })(id));
            }
            return results;
          })();
          return async.parallel(loaders, function(err) {
            return cb(err, all);
          });
        };
      })(this));
    }
  };

  allSync() {
    var db, f, i, item, len, objects, ref;
    if (this._memory) {
      return this._cache;
    }
    if (this._single) {
      db = getObjectFromFileSync.apply(this);
      if (typeof db !== "object") {
        throw new Error("could not load database");
      }
      return db;
    } else {
      objects = {};
      ref = readIDsSync(this._dir);
      for (i = 0, len = ref.length; i < len; i++) {
        f = ref[i];
        item = getObjectFromFileSync.call(this, f);
        if (item != null) {
          objects[f] = item;
        } else {
          console.error("could not load '" + f + "'");
        }
      }
      return objects;
    }
  }

}

module.exports = Store;
