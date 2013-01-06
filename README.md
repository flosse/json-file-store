# simple-js

A simple JSON store for node.js.

[![Build Status](https://secure.travis-ci.org/flosse/simple-js.png)](http://travis-ci.org/flosse/simple-js)

WARNING:
Don't use it if you want to persist a large amount of objects.
Use a real DB instead.

## Install

  npm install simple-js

## Usage

```javascript
var Store = require("simple-js");
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

db.get("anId", function(err, obj){
  // obj = { foo: "bar" }
})

db.all(function(err, objs){
  // objs is a map: ID => OBJECT
});

db.delete("myId", function(err){
  // the file data/myId.json was removed
});
```

### Single file mode

If you want to store all objects in a single file, just set the `single` flag:

```javascript
var db = new Store("data",{single:true});
```

or point to a JSON file:

```javascript
var db = new Store("./path/to/data.json");
```

## License

This project is licensed under the MIT License.
