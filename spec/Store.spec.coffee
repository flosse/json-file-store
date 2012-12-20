fs            = require 'fs'
global.buster = require "buster"
global.sinon  = require "sinon"
Store         = require "../src/Store"

buster.spec.expose()

describe "simple-js", ->

  it "is a class", ->
    (expect typeof Store).toBe "function"

  it "can save an object", (done) ->
    store = new Store "test"
    data  = {id: "id", x: 56 }
    store.save data, (err) ->
      (expect err).toBeFalsy()
      fs.readFile "./test/id.json", (err, content) ->
        (expect content).toEqual """
          {
            "id": "id",
            "x": 56
          }
          """
        done()

  it "can load an object", (done) ->

    store = new Store "test"
    data  = { x: 87 }
    store.save data, (err, id) ->
      store.get id, (err, o) ->
        (expect o.x).toBe 87
        done()

  it "can delete an object", (done) ->
    store = new Store "test"
    data  = { y: 88 }
    store.save data, (err, id) ->
      fs.readFile "./test/#{id}.json", (err, content) ->
        (expect content).not.toBe ""
        store.delete id, (err) ->
          fs.readFile "./test/#{id}.json", (err, content) ->
            (expect err).toBeDefined()
            done()
