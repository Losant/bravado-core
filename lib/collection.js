const util = require('util');
const defaults = require('defaults');
const Entity = require('./entity');

// Object that represents a collection of entities returned by a resource's action
const Collection = function(options, ...rest) {
  Entity.apply(this, options, ...rest);
  this.itemType = options.itemType;
  this.itemFactory = options.itemFactory;
  this.body = defaults(options.body, {
    count: 0,
    items: []
  });
  if (options.items) {
    this.body.items = options.items.map(function(item) {
      return this.createItemEntity(item);
    });
    this.body.count = this.body.items.length;
  }
};

util.inherits(Collection, Entity);

Collection.prototype.addItem = function(obj) {
  this.body.items.push(obj instanceof Entity || !this.itemType ? obj : this.itemFactory(obj));
  this.body.count += 1;
};

Collection.prototype.addAll = function(arr) {
  this.body.items = arr.map(function(item) {
    return item instanceof Entity || !this.itemType ? item : this.itemFactory(item);
  }.bind(this));
  this.body.count = this.body.items.length;
};

Collection.prototype.toJSON = function(options) {
  const obj = Entity.prototype.toJSON.call(this, options);
  obj.items = obj.items.map(function(item) {
    return item.toJSON ? item.toJSON(options) : item;
  });
  return obj;
};

module.exports = Collection;
