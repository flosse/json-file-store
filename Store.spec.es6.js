import fs       from 'fs';
import path     from 'path';
import chai     from 'chai';
import Store    from './Store';
import { exec } from 'child_process';

const should = chai.should();

describe("The jfs module", () => {

  const NAME = ".specTests";

  afterEach(function(done) {
    fs.unlink(NAME + '.json', (err) => {
      exec("rm -rf ./" + NAME, (err, out) => {
        console.log(out);
        if (err !== null) {
          console.error(err);
        }
        done();
      });
    });
  });

  it("is a class", () => {
    Store.should.be.a["function"];
  });

  it("resolves the path correctly", () => {
    const x1 = new Store("./foo/bar", {
      type: 'memory'
    });
    x1._dir.should.equal(process.cwd() + '/foo/bar');
    const x2 = new Store(__dirname + "/foo/bar", {
      type: 'memory'
    });
    x2._dir.should.equal(process.cwd() + '/foo/bar');
  });

  describe("save method", () => {

    it("can save an object", (done) => {
      const store = new Store(NAME);
      const data = {
        x: 56
      };
      store.save("id", data, (err) => {
        should.not.exist(err);
        fs.readFile("./" + NAME + "/id.json", "utf-8", (err, content) => {
          content.should.equal('{"x":56}');
          store.save("emptyObj", {}, (err) => {
            should.not.exist(err);
            store.get("emptyObj", (err, o) => {
              should.not.exist(err);
              o.should.eql({});
              done();
            });
          });
        });
      });
    });

    it("can autosave the id", (done) => {
      const store = new Store(NAME, {
        saveId: true
      });
      store.save({}, (err, id) => {
        store.get(id, (err, o) => {
          o.id.should.equal(id);
          done();
        });
      });
    });

    it("can autosave the id with a custom key", (done) => {
      const store = new Store(NAME, {
        saveId: 'myCustomKey'
      });
      store.save({}, (err, id) => {
        store.get(id, (err, o) => {
          o.myCustomKey.should.equal(id);
          done();
        });
      });
    });

    it("can autosave the id with a custom generator", (done) => {
      const store = new Store(NAME, {
        idGenerator: () => "customId",
        saveId: true
      });
      store.save({}, (err, id) => {
        store.get(id, (err, o) => {
          o.id.should.equal("customId");
          done();
        });
      });
    });

    it("can save an object synchronously", () => {
      const store = new Store(NAME);
      const data = {
        s: "ync"
      };
      const id = store.saveSync("id", data);
      id.should.equal("id");
      const content = fs.readFileSync("./" + NAME + "/id.json", "utf-8");
      content.should.equal('{"s":"ync"}');
    });

    it("creates a deep copy for the cache", (done) => {
      const store = new Store(NAME + '.json');
      const z = [];
      const y = {
        z: z
      };
      const data = {
        x: 56,
        y: y
      };
      store.save(data, (err, id) => {
        store.get(id, (err, res) => {
          res.should.eql(data);
          res.should.not.equal(data);
          res.y.should.eql(y);
          res.y.should.not.equal(y);
          res.y.z.should.eql(z);
          res.y.z.should.not.equal(z);
          done();
        });
      });
    });
  });

  describe("get method", () => {

    it("can load an object", (done) => {
      const store = new Store(NAME);
      const data = {
        x: 87
      };
      store.save(data, (err, id) => {
        store.get(id, (err, o) => {
          o.x.should.equal(87);
          done();
        });
      });
    });

    it("returns an error if it cannot load an object", (done) => {
      let store = new Store(NAME);
      store.get("foobarobject", (err, o) => {
        err.should.be.truthy;
        err.message.should.equal("could not load data");
        store = new Store(NAME, {
          type: "memory"
        });
        store.get("foobarobject", (err, o) => {
          err.message.should.equal("could not load data");
          store = new Store(NAME, {
            type: "single"
          });
          store.get("foobarobject", (err, o) => {
            err.message.should.equal("could not load data");
            done();
          });
        });
      });
    });
  });

  describe("getSync method", () => {

    it("can load an object synchronously", () => {
      const store = new Store(NAME);
      const data = {
        x: 87
      };
      const id = store.saveSync(data);
      const o = store.getSync(id);
      o.x.should.equal(87);
    });

    it("returns an error if it cannot load an object", () => {
      let store = new Store(NAME);
      let err = store.getSync("foobarobject");
      err.should.be.truthy;
      err.message.should.equal("could not load data");
      store = new Store(NAME, {
        type: "memory"
      });
      err = store.getSync("foobarobject");
      err.message.should.equal("could not load data");
      store = new Store(NAME, {
        type: "single"
      });
      err = store.getSync("foobarobject");
      err.message.should.equal("could not load data");
    });
  });

  describe("getAll method", () => {

    it("can load all objects", (done) => {
      const store = new Store(NAME);
      const x1 = {
        j: 3
      };
      const x2 = {
        k: 4
      };
      store.save(x1, (err, id1) => {
        store.save(x2, (err, id2) => {
          store.all((err, all) => {
            should.not.exist(err);
            all[id1].j.should.equal(3);
            all[id2].k.should.equal(4);
            done();
          });
        });
      });
    });

    it("can load all objects synchronously", () => {
      const store = new Store(NAME);
      const x1 = {
        j: 3
      };
      const x2 = {
        k: 4
      };
      const id1 = store.saveSync(x1);
      const id2 = store.save(x2);
      const all = store.allSync();
      (all instanceof Error).should.be.falsy;
      all[id1].j.should.equal(3);
      all[id2].k.should.equal(4);
    });
  });

  describe("delete method", () => {

    it("can delete an object", (done) => {
      const store = new Store(NAME);
      const data = {
        y: 88
      };
      store.save(data, (err, id) => {
        fs.readFile("./" + NAME + "/" + id + ".json", "utf-8", (err, content) => {
          content.should.not.eql("");
          store["delete"](id, (err) => {
            fs.readFile("./" + NAME + "/" + id + ".json", "utf-8", (err, content) => {
              err.should.exist;
              done();
            });
          });
        });
      });
    });

    it("returns an error if the record does not exist", (done) => {
      let store = new Store(NAME);
      store["delete"]("blabla", (err) => {
        (err instanceof Error).should.be["true"];
        store = new Store(NAME, {
          type: "single"
        });
        store["delete"]("blabla", (err) => {
          (err instanceof Error).should.be["true"];
          store = new Store(NAME, {
            type: "memory"
          });
          store["delete"]("blabla", (err) => {
            (err instanceof Error).should.be["true"];
            done();
          });
        });
      });
    });
  });

  describe("deleteSync method", () => {

    it("can delete an object synchonously", () => {
      const store = new Store(NAME);
      const data = {
        y: 88
      };
      const id = store.saveSync(data);
      const content = fs.readFileSync("./" + NAME + "/" + id + ".json", "utf-8");
      content.should.not.eql("");
      const err = store.deleteSync(id);
      should.not.exist(err);
      (() => fs.readFileSync("./" + NAME + "/" + id + ".json", "utf-8"))
        .should["throw"]();
    });

    it("returns an error if the record does not exist", () => {
      let store = new Store(NAME);
      let err = store.deleteSync("blabla");
      (err instanceof Error).should.be["true"];
      store = new Store(NAME, {
        type: "single"
      });
      err = store.deleteSync("blabla");
      (err instanceof Error).should.be["true"];
      store = new Store(NAME, {
        type: "memory"
      });
      err = store.deleteSync("12345");
      (err instanceof Error).should.be["true"];
    });
  });

  it("can pretty print the file content", () => {
    const store = new Store(NAME, {
      pretty: true
    });
    const id = store.saveSync("id", {
      p: "retty"
    });
    const content = fs.readFileSync("./" + NAME + "/id.json", "utf-8");
    content.should.equal("{\n  \"p\": \"retty\"\n}");
  });

  describe("'single' mode", () => {

    it("stores data in a single file", (done) => {
      const store = new Store(NAME, {
        type: 'single',
        pretty: true
      });

      fs.readFile("./" + NAME + ".json", "utf-8", (err, content) => {
        content.should.equal("{}");
        const d1 = {
          x: 0.6
        };
        const d2 = {
          z: -3
        };
        store.save("d1", d1, (err) => {
          should.not.exist(err);
          store.save("d2", d2, (err) => {
            should.not.exist(err);
            const f = path.join(process.cwd(), NAME + ".json");
            fs.readFile(f, "utf-8", (err, content) => {
              should.not.exist(err);
              content.should.equal("{\n  \"d1\": {\n    \"x\": 0.6\n  },\n  \"d2\": {\n    \"z\": -3\n  }\n}");
              done();
            });
          });
        });
      });
    });

    /*
    fs.rename 'overrides' an existing file
    even if its write protected
     */
    it("it checks for write protection", (done) => {
      const f = path.resolve(NAME + "/mydb.json");
      const store = new Store(f, {
        type: 'single'
      });
      store.saveSync('id', {
        some: 'data'
      });
      fs.chmodSync(f, '0444');
      store.save('foo', {
        bar: 'baz'
      }, function(err, id) {
        should.exist(err);
        fs.chmodSync(f, '0644');
        done();
      });
    });

    it("loads an existing db", (done) => {
      let store = new Store(NAME, {
        single: true
      });
      store.save("id1", {
        foo: "bar"
      }, (err) => {
        store = new Store(NAME, {
          single: true
        });
        fs.readFile("./" + NAME + ".json", "utf-8", (err, content) => {
          content.should.equal('{"id1":{"foo":"bar"}}');
          store.all((err, items) => {
            should.not.exist(err);
            items.id1.should.eql({
              foo: "bar"
            });
            done();
          });
        });
      });
    });

    it("get data from a single file", (done) => {
      const store = new Store(NAME, {
        single: true
      });
      const data = {
        foo: "asdlöfj"
      };
      store.save(data, (err, id) => {
        store.get(id, (err, o) => {
          o.foo.should.equal("asdlöfj");
          done();
        });
      });
    });

    it("can delete an object", (done) => {
      const store = new Store(NAME, {
        single: true
      });
      const data = {
        y: 88
      };
      const f = path.join(process.cwd(), NAME + ".json");
      store.save(data, (err, id) => {
        fs.readFile(f, "utf-8", (err, content) => {
          (content.length > 7).should.be.truthy;
          store["delete"](id, (err) => {
            fs.readFile(f, "utf-8", (err, content) => {
              should.not.exist(err);
              content.should.equal("{}");
              done();
            });
          });
        });
      });
    });

    it("can be defined if the name is a file", (done) => {
      const store = new Store('./' + NAME + '/foo.json');
      store._single.should.be["true"];
      const f = path.join(process.cwd(), "./" + NAME + "/foo.json");
      return fs.readFile(f, "utf-8", (err, content) => {
        should.not.exist(err);
        content.should.equal("{}");
        return done();
      });
    });
  });

  describe("'memory' mode", () => {

    it("does not write the data to a file", (done) => {
      const store = new Store(NAME, {
        type: 'memory'
      });
      const data = {
        y: 78
      };
      store.save("id", data, (err, id) => {
        should.not.exist(err);
        fs.readFile("./" + NAME + "/id.json", "utf-8", (err, content) => {
          should.exist(err);
          should.not.exist(content);
          store.allSync().should.eql({
            id: {
              y: 78
            }
          });
          store.saveSync('foo', {
            bar: 'baz'
          });
          store.all((err, d) => {
            should.not.exist(err);
            d.should.eql({
              foo: {
                bar: 'baz'
              },
              id: {
                y: 78
              }
            });
            store.deleteSync('id');
            store.allSync().should.eql({
              foo: {
                bar: 'baz'
              }
            });
            should["throw"](() =>
              fs.readFileSync("./" + NAME + "/id.json", "utf-8"));
            done();
          });
        });
      });
    });
  });
});
