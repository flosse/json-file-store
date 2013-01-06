fs            = require 'fs'
path          = require 'path'
global.buster = require "buster"
global.sinon  = require "sinon"
Store         = require "../src/Store"

buster.spec.expose()

describe "simple-js", ->

  NAME = ".specTests"

  after ->
    try
      fs.unlinkSync NAME + '.json'
    catch e
      console.info e.message

  it "is a class", ->
    (expect typeof Store).toBe "function"

  it "can save an object", (done) ->
    store = new Store NAME
    data  = { x: 56 }
    store.save "id", data, (err) ->
      (expect err).toBeFalsy()
      fs.readFile "./#{NAME}/id.json", (err, content) ->
        (expect content).toEqual """
          {
            "x": 56
          }
          """
        done()

  it "can load an object", (done) ->
    store = new Store NAME
    data  = { x: 87 }
    store.save data, (err, id) ->
      store.get id, (err, o) ->
        (expect o.x).toBe 87
        done()

  it "can load all objects", (done) ->
    store = new Store NAME
    x1 = { j: 3 }
    x2 = { k: 4 }
    store.save x1, (err, id1) ->
      store.save x2, (err, id2) ->
        store.all (err, all) ->
          (expect err).toBeFalsy()
          (expect all[id1].j).toBe 3
          (expect all[id2].k).toBe 4
          done()

  it "can delete an object", (done) ->
    store = new Store NAME
    data  = { y: 88 }
    store.save data, (err, id) ->
      fs.readFile "./#{NAME}/#{id}.json", (err, content) ->
        (expect content).not.toBe ""
        store.delete id, (err) ->
          fs.readFile "./#{NAME}/#{id}.json", (err, content) ->
            (expect err).toBeDefined()
            done()

  describe "single file mode", (done) ->

    it "can store data in a single file", (done) ->
      store = new Store NAME, single: true
      d1  = { x: 0.6 }
      d2  = { z: -3 }
      store.save "d1", d1, (err) ->
        (expect err).toBeFalsy()
        store.save "d2", d2, (err) ->
          (expect err).toBeFalsy()
          f = path.join process.cwd(), "#{NAME}.json"
          fs.readFile f, (err, content) ->
            (expect err).toBeFalsy()
            (expect content).toEqual """
              {
                "d1": {
                  "x": 0.6
                },
                "d2": {
                  "z": -3
                }
              }
              """
            done()

    it "get data from a single file", (done) ->
      store = new Store NAME, single:true
      data  = { foo: "asdlöfj" }
      store.save data, (err, id) ->
        store.get id, (err, o) ->
          (expect o.foo).toBe "asdlöfj"
          done()

    it "can delete an object", (done) ->
      store = new Store NAME, single:true
      data  = { y: 88 }
      f = path.join process.cwd(), "#{NAME}.json"
      store.save data, (err, id) ->
        fs.readFile f, (err, content) ->
          (expect content.length > 7).toBe true
          store.delete id, (err) ->
            fs.readFile f, (err, content) ->
              (expect err).toBeFalsy()
              (expect content).toEqual "{}"
              done()

    it "can be defined if the name is a file", (done) ->
      store = new Store './foo/' + NAME + '.json'
      (expect store._single).toBe true
      f = path.join process.cwd(), "./foo/#{NAME}.json"
      fs.readFile f, (err, content) ->
        (expect err).toBeFalsy()
        (expect content).toEqual ""
        done()
