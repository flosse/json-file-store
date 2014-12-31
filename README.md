# JSON file store

A simple JSON file store for node.js.

[![Build Status](https://secure.travis-ci.org/flosse/json-file-store.svg?branch=master)](http://travis-ci.org/flosse/json-file-store)
[![Dependency Status](https://gemnasium.com/flosse/json-file-store.svg)](https://gemnasium.com/flosse/json-file-store)
[![NPM version](https://badge.fury.io/js/jfs.svg)](http://badge.fury.io/js/jfs)
[![License](https://img.shields.io/npm/l/jfs.svg)](https://github.com/flosse/json-file-store/blob/master/LICENCE.txt)

WARNING:
Don't use it if you want to persist a large amount of objects.
Use a real DB instead.

## Install

    npm install jfs --save

## Usage

```javascript
var Store = require("jfs");
var db = new Store("data");

var d = {
  foo: "bar"
};

// save with custom ID
db.save("anId", d, function(err){
  // now the data is stored in the file data/anId.json
});

// save with generated ID
db.save(d, function(err, id){
  // id is a unique ID
});

// save synchronously
var id = db.saveSync("anId", d);

db.get("anId", function(err, obj){
  // obj = { foo: "bar" }
})

// pretty print file content
var prettyDB = new Store("data",{pretty:true});
var id = prettyDB.saveSync({foo:{bar:"baz"}});
// now the file content is formated in this way:
{
  "foo": {
    "bar": "baz"
  }
}
// instead of this:
{"foo":{"bar":"baz"}}

// get synchronously
var obj = db.getSync("anId");

// get all available objects
db.all(function(err, objs){
  // objs is a map: ID => OBJECT
});

// get all synchronously
var objs = db.allSync()

// delete by ID
db.delete("myId", function(err){
  // the file data/myId.json was removed
});

// delete synchronously
db.delete("myId");
```

### Single file DB

If you want to store all objects in a single file,
set the `type` option to `single`:

```javascript
var db = new Store("data",{type:'single'});
```

or point to a JSON file:

```javascript
var db = new Store("./path/to/data.json");
```

### In memory DB

If you don't want to persist your data, you can set `type` to `memory`:

```javascript
var db = new Store("data",{type:'memory'});
```

### ID storage

By default the ID is not stored within your object.
If you like, you can change that behavior by setting `saveId` to `true`
or a custom ID

```javascript
var db = new Store("data",{saveId:'myKey'});
```


## Tests

    npm test

## License

This project is licensed under the MIT License.
