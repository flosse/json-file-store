###
Copyright (C) 2012 Markus Kohlhase <mail@markus-kohlhase.de>
###

async  = require 'async'
fs     = require 'fs'
path   = require 'path'
uuid   = require 'node-uuid'
mkdirp = require 'mkdirp'

class Store

  constructor: (name='store') ->

    @_dir   = path.join process.cwd(), name
    @_cache = {}
    mkdirp.sync @_dir

  _id2file: (id) -> path.join @_dir,"#{id}.json"

  save: (o, cb=->) ->
    o.id ?= uuid.v4()
    try
      json = JSON.stringify o, null, 2
      fs.writeFile @_id2file(o.id), json, 'utf8', (err) =>
        if err?
          cb err
        else
          @_cache[o.id] = o
          cb null
    catch e
      cb e

  get: (id, cb=->) ->
    o = @_cache[id]
    if o?
      cb null, o
    else
      fs.readFile @_id2file(id), (err, json) =>
        return cb err if err?
        try
          o = JSON.parse json
          @_cache[id] = o
          cb null, o
        catch e
          cb e

  delete: (id, cb) ->
    fs.unlink @_id2file(id), (err) =>
      if err?
        cb err
      else
        delete @_cache[id]
        cb null

  all: (cb=->) ->
    that = @
    fs.readdir @_dir, (err, files) =>
      return cb err if err?
      files   = files.filter (f)  -> f.substr(-5) is ".json"
      files   = files.map    (f)  -> f.split(".json")[0]
      loaders = files.map    (id) -> (cb) -> that.get id, cb
      async.parallel loaders, cb

module.exports = Store
