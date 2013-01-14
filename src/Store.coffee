###
Copyright (C) 2012 - 2013 Markus Kohlhase <mail@markus-kohlhase.de>
###

async  = require 'async'
fs     = require 'fs'
path   = require 'path'
uuid   = require 'node-uuid'
mkdirp = require 'mkdirp'
clone  = require 'clone'

isJSONFile = (f) -> f.substr(-5) is ".json"
removeFileExtension = (f) -> f.split(".json")[0]
getIDs = (a) -> a.filter(isJSONFile).map(removeFileExtension)
readIDsSync = (d) -> getIDs fs.readdirSync d
readIDs = (d, cb) -> fs.readdir d, (err, ids) -> cb err, getIDs ids

getObjectFromFileSync = (id) ->
  try
    JSON.parse fs.readFileSync (@_getFileName id), "utf8"
  catch e
    console.error e
    e

getObjectFromFile = (id, cb) ->
 fs.readFile @_getFileName(id), "utf8", (err, o) ->
   return cb err if err?
   try
     cb null, JSON.parse o
   catch e
     console.error e
     cb e

id2fileName = (id, dir) -> path.join dir,"#{id}.json"

save = (id, o, cb) ->
  if typeof id is "object"
    cb = o
    o = id
    id = null
  id ?= uuid.v4()
  file = @_getFileName id
  o = clone o
  data = if @_single
    backup = @_cache[id]
    @_cache[id] = o
    @_cache
  else o
  done = (err) =>
    if err?
      @_cache[id] = backup if @_single
      if cb? then cb err else err
    else
      @_cache[id] = o
      if cb? then  cb null, id else id
  try
    json = JSON.stringify data, null, 2
    if cb? then fs.writeFile file, json, 'utf8', done
    else done fs.writeFileSync file, json, 'utf8'
  catch e
    if cb? then cb e else e

get = (id, cb) ->
  o = clone @_cache[id]
  return (if cb? then cb null, o else o) if o?
  done = (err, o) =>
    if err
      e = new Error "could not load data"
      return if cb? then cb e else e
    item = if @_single then o[id] else o
    if not item?
      e = new Error "could not load data"
      return if cb? then cb e else e
    @_cache[id] = item
    if cb? then cb null, item else item
  if cb? then getObjectFromFile.call @, id, done
  else
    err = (o = getObjectFromFileSync.call @, id) instanceof Error
    done err, o

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
      if not fs.existsSync fn
        if fs.writeFileSync fn, "{}", 'utf8'
          throw new Error "could not create database"
      @_cache = @allSync()

  _getFileName: (id) -> if @_single then "#{@_dir}/#{path.basename @name}.json" else id2fileName id, @_dir

  save: (id, o, cb=->) -> save.call @, id, o, cb

  saveSync: (id, o) -> save.call @, id, o

  get: (id, cb=->) -> get.call @, id, cb

  getSync: (id) -> get.call @, id

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
      fs.readFile @_getFileName(), "utf8", (err, content) ->
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
