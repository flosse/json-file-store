###
Copyright (C) 2012 - 2013 Markus Kohlhase <mail@markus-kohlhase.de>
###

async  = require 'async'
fs     = require 'fs'
path   = require 'path'
uuid   = require 'node-uuid'
mkdirp = require 'mkdirp'

isJSONFile = (f) -> f.substr(-5) is ".json"
removeFileExtension = (f) -> f.split(".json")[0]
getIDs = (a) -> a.filter(isJSONFile).map(removeFileExtension)
readIDsSync = (d) -> getIDs fs.readdirSync d
readIDs = (d, cb) -> fs.readdir d, (err, ids) -> cb err, getIDs ids

getObjectFromFileSync = (id) ->
  try
    JSON.parse fs.readFileSync @_getFileName id
  catch e
    console.error e

getObjectFromFile = (id, cb) ->
 fs.readFile @_getFileName(id), (err, o) ->
   return cb err if err?
   try
     cb null, JSON.parse o
   catch e
     console.error e
     cb e

id2fileName = (id, dir) -> path.join dir,"#{id}.json"

class Store

  constructor: (@name='store', opt={}) ->

    @_single = opt.single
    if isJSONFile @name
      @name = @name.split(".json")[0]
      @_single = true

    @_dir = path.join process.cwd(), @name
    @_dir = path.dirname @_dir if @_single

    @_cache = {}

    mkdirp.sync @_dir

    if @_single
      fn = @_getFileName()
      if not fs.exists fn
        if fs.writeFileSync fn, "{}", 'utf8'
          throw new Error "could not create database"
      @_cache = @allSync()

  _getFileName: (id) -> if @_single then "#{@_dir}/#{path.basename @name}.json" else id2fileName id, @_dir

  save: (id, o, cb=->) ->
    if typeof id is "object"
      cb = o
      o = id
      id = null
    id ?= uuid.v4()
    file = @_getFileName id
    data = if @_single then @_cache[id] = o; @_cache else o
    try
      json = JSON.stringify data, null, 2
      fs.writeFile file, json, 'utf8', (err) =>
        if err?
          delete @_cache[o.id] if @_single
          cb err
        else
          @_cache[id] = o
          cb null, id
    catch e
      cb e

  get: (id, cb=->) ->
    o = @_cache[id]
    return cb null, o if o?
    getObjectFromFile.call @, id, (err, o) =>
      return cb new Error "could not load data" if err?
      item = if @_single then o[id] else o
      return cb new Error "could not load data" if not item?
      @_cache[id] = item
      cb null, item

  delete: (id, cb) ->
    file = @_getFileName(id)
    if @_single
      backup = @_cache[id]
      delete @_cache[id]
      json = JSON.stringify @_cache, null, 2
      fs.writeFile file, json, 'utf8', (err) =>
        if err?
          @_cache[id] = backup
          cb err
        else
          cb null
    else
      fs.unlink file, (err) =>
        return cb err if err?
        delete @_cache[id]
        cb null

  all: (cb=->) ->
    if @_single
      fs.readFile @_getFileName(), (err, content) ->
        return cb err if err?
        try
          cb null, JSON.parse content
        catch e
          cb e
    else
      readIDs @_dir, (err, ids) =>
        return cb err if err?
        that = @
        all  = {}
        loaders = for id in ids then do (id) ->
          (cb) ->
            that.get id, (err, o) ->
              all[id] = o if not err?
              cb err
        async.parallel loaders, (err) -> cb err, all

  allSync: ->
    if @_single
      db = getObjectFromFileSync.apply @
      throw new Error "could not load database" unless typeof db is "object"
      db
    else
      objects = {}
      for f in readIDsSync @_dir
        item = getObjectFromFileSync.call @, f
        if item?
          objects[f] = item
        else
          console.error "could not load '#{f}'"
      objects

module.exports = Store
