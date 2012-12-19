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
