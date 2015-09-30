var util = require('util');
var defaults = require('defaults');
var Entity = require('./entity');

function Collection (options) {
  Entity.apply(this, arguments);
  this.itemType = options.itemType;
  this.itemFactory = options.itemFactory;
  this.body = defaults(options.body, {
    count: 0,
    items: []
  });
  if (options.items) {
    this.body.items = options.items.map(function (item) {
      return this.createItemEntity(item);
    });
    this.body.count = this.body.items.length;
  }
}

util.inherits(Collection, Entity);

Collection.prototype.addItem = function (obj) {
  this.body.items.push(obj instanceof Entity || !this.itemType ? obj : this.itemFactory(obj));
  this.body.count += 1;
};

Collection.prototype.toJSON = function (options) {
  var obj = Entity.prototype.toJSON.call(this, options);
  obj.items = obj.items.map(function (item) {
    return item.toJSON ? item.toJSON(options) : item;
  });
  return obj;
};

module.exports = Collection;