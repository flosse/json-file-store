###
Copyright (C) 2012 - 2015 Markus Kohlhase <mail@markus-kohlhase.de>
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

canWrite = (stat) ->

  owner = process.getuid?() is stat.uid
  group = process.getgid?() is stat.gid

  owner  and (stat.mode & 128) or # User is owner and owner can write.
  group  and (stat.mode & 16 ) or # User is in group and group can write.
             (stat.mode & 2  )    # Anyone can write.

canWriteToFile = (file, cb) ->
  fs.exists file, (e) ->
    return cb null unless e
    fs.stat file, (err, s) ->
      return cb err if err
      if canWrite s then cb null
      else cb new Error "File is protected"

canWriteToFileSync = (file) ->
  return unless fs.existsSync file
  if canWrite fs.statSync file then return
  else throw new Error "File is protected"

getObjectFromFileSync = (id) ->
  try
    JSON.parse fs.readFileSync (@_getFileName id), "utf8"
  catch e
    e

getObjectFromFile = (id, cb) ->
  fs.readFile @_getFileName(id), "utf8", (err, o) ->
    return cb err if err
    try
      cb null, JSON.parse o
    catch e
      cb e

saveObjectToFile = (o, file, cb) ->
  indent = if @_pretty then 2
  try
    json = JSON.stringify o, null, indent
  catch e
    return if cb? then cb e else e
  tmpFileName = file + uuid.v4() + ".tmp"
  if cb?
    canWriteToFile file, (err) ->
      return cb err if err
      fs.writeFile tmpFileName, json, 'utf8', (err) ->
        return cb err if err
        fs.rename tmpFileName, file, cb
  else
    try
      canWriteToFileSync file
      fs.writeFileSync tmpFileName, json, 'utf8'
      fs.renameSync tmpFileName, file
    catch e
      e

id2fileName = (id, dir) -> path.join dir,"#{id}.json"

save = (id, o, cb) ->
  if typeof id is "object"
    cb = o
    o = id
    id = null
  id ?= uuid.v4()
  file = @_getFileName id
  o = clone o
  if @_saveId
    if (typeof (k=@_saveId)) is 'string' and k.length > 0 then o[k] = id
    else o.id = id
  data =
    if @_single
      backup = @_cache[id]
      @_cache[id] = o
      @_cache
    else o
  done = (err) =>
    if err
      @_cache[id] = backup if @_single
      if cb? then cb err else err
    else
      @_cache[id] = o
      if cb? then cb null, id else id
  if @_memory then done()
  else
    if cb? then saveObjectToFile.call @, data, file, done
    else done saveObjectToFile.call @, data, file

get = (id, cb) ->
  o = clone @_cache[id]
  return (if cb? then cb null, o else o) if o?
  done = (err, o) =>
    if err
      e = new Error "could not load data"
      return if cb? then cb e else e
    item = if @_single then o[id] else o
    unless item?
      e = new Error "could not load data"
      return if cb? then cb e else e
    @_cache[id] = item
    if cb? then cb null, item else item
  return done null, o if @_memory
  return getObjectFromFile.call @, id, done if cb?
  err = (o = getObjectFromFileSync.call @, id) instanceof Error
  done (o if err), (o unless err)

remove = (id, cb) ->
  file        = @_getFileName id
  cacheBackup = @_cache[id]
  notInCache  = new Error "#{id} does not exist" unless cacheBackup?
  done = (err) =>
    if err
      @_cache[id] = cacheBackup
      return (if cb? then cb err else err)
    delete @_cache[id]
    cb?()
  if @_single
    delete @_cache[id]
    return done notInCache if @_memory or notInCache?
    return saveObjectToFile.call @, @_cache, file, done if cb?
    err = (o = saveObjectToFile.call @, @_cache, file) instanceof Error
    done (o if err), (o unless err)
  else
    return done notInCache if @_memory
    return fs.unlink file, done if cb?
    try
      done fs.unlinkSync file
    catch e
      done e

class Store

  constructor: (@name='store', opt={}) ->

    @_single = opt.single is true or opt.type is 'single'
    @_pretty = opt.pretty is true
    @_memory = opt.memory is true or opt.type is 'memory'
    @_saveId = opt.saveId

    if isJSONFile @name
      @name = @name.split(".json")[0]
      @_single = true

    @_dir = path.resolve @name
    @_dir = path.dirname @_dir if @_single

    @_cache = {}

    mkdirp.sync @_dir unless @_memory

    if @_single
      fn = @_getFileName()
      unless @_memory
        unless fs.existsSync fn
          if fs.writeFileSync fn, "{}", 'utf8'
            throw new Error "could not create database"
      @_cache = @allSync()

  _getFileName: (id) ->
    if @_single then path.join @_dir, (path.basename @name) + ".json"
    else id2fileName id, @_dir

  save: (id, o, cb=->) -> save.call @, id, o, cb

  saveSync: (id, o) -> save.call @, id, o

  get: (id, cb=->) -> get.call @, id, cb

  getSync: (id) -> get.call @, id

  delete: (id, cb) -> remove.call @, id, cb

  deleteSync: (id) -> remove.call @, id

  all: (cb=->) ->
    if @_memory then cb null, @_cache
    else if @_single
      getObjectFromFile.call @, undefined, cb
    else
      readIDs @_dir, (err, ids) =>
        return cb err if er?
        that = @
        all  = {}
        loaders = for id in ids then do (id) ->
          (cb) ->
            that.get id, (err, o) ->
              all[id] = o unless err
              cb err
        async.parallel loaders, (err) -> cb err, all

  allSync: ->
    if @_memory then return @_cache
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
