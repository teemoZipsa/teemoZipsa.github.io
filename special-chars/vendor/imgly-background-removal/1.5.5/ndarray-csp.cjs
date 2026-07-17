/*
 * CSP-safe ndarray-compatible view constructor used by the vendored IMG.LY
 * bundle. Derived from ndarray 1.0.19 (MIT); see licenses/ndarray-LICENSE.
 * This source intentionally avoids new Function and eval.
 */
'use strict';

const hasTypedArrays = typeof Float64Array !== 'undefined';

function compareFirst(a, b) {
  return a[0] - b[0];
}

function order() {
  const terms = this.stride.map((stride, index) => [Math.abs(stride), index]);
  terms.sort(compareFirst);
  return terms.map(term => term[1]);
}

function isBuffer(data) {
  return Boolean(data && data.constructor && typeof data.constructor.isBuffer === 'function' && data.constructor.isBuffer(data));
}

function arrayDType(data) {
  if (isBuffer(data)) return 'buffer';
  if (hasTypedArrays) {
    switch (Object.prototype.toString.call(data)) {
      case '[object Float64Array]': return 'float64';
      case '[object Float32Array]': return 'float32';
      case '[object Int8Array]': return 'int8';
      case '[object Int16Array]': return 'int16';
      case '[object Int32Array]': return 'int32';
      case '[object Uint8Array]': return 'uint8';
      case '[object Uint16Array]': return 'uint16';
      case '[object Uint32Array]': return 'uint32';
      case '[object Uint8ClampedArray]': return 'uint8_clamped';
      case '[object BigInt64Array]': return 'bigint64';
      case '[object BigUint64Array]': return 'biguint64';
    }
  }
  if (Array.isArray(data)) return 'array';
  return 'generic';
}

const cachedConstructors = {
  float32: [], float64: [], int8: [], int16: [], int32: [], uint8: [],
  uint16: [], uint32: [], array: [], uint8_clamped: [], bigint64: [],
  biguint64: [], buffer: [], generic: []
};

function compileConstructor(dtype, dimension) {
  const useGetters = dtype === 'generic';

  function View(data, shape, stride, offset) {
    this.data = data;
    this.shape = dimension < 0 ? [] : Array.prototype.slice.call(shape || []);
    this.stride = dimension < 0 ? [] : Array.prototype.slice.call(stride || []);
    this.offset = dimension < 0 ? 0 : offset | 0;
  }

  function construct(data, shape, stride, offset) {
    return new View(data, shape, stride, offset);
  }

  const proto = View.prototype;
  proto.dtype = dtype;
  proto.dimension = dimension;

  if (dimension < 0) {
    proto.index = () => -1;
    proto.size = 0;
    proto.shape = proto.stride = proto.order = [];
    proto.lo = proto.hi = proto.transpose = proto.step = function copyNil() { return construct(this.data); };
    proto.get = proto.set = () => undefined;
    proto.pick = () => null;
    return construct;
  }

  Object.defineProperty(proto, 'size', {
    get() {
      let result = 1;
      for (let index = 0; index < this.shape.length; index += 1) result *= this.shape[index];
      return result;
    }
  });

  Object.defineProperty(proto, 'order', {
    get() {
      if (dimension === 0) return [];
      if (dimension === 1) return [0];
      return order.call(this);
    }
  });

  proto.index = function index(...indices) {
    let result = this.offset;
    for (let axis = 0; axis < dimension; axis += 1) result += this.stride[axis] * indices[axis];
    return result;
  };

  proto.get = function get(...indices) {
    const index = this.index(...indices);
    return useGetters ? this.data.get(index) : this.data[index];
  };

  proto.set = function set(...args) {
    const value = args.pop();
    const index = this.index(...args);
    if (useGetters) return this.data.set(index, value);
    return (this.data[index] = value);
  };

  if (dimension === 0) proto.valueOf = proto.get;

  proto.hi = function hi(...limits) {
    const shape = this.shape.slice();
    for (let axis = 0; axis < dimension; axis += 1) {
      if (typeof limits[axis] === 'number' && limits[axis] >= 0) shape[axis] = limits[axis] | 0;
    }
    return construct(this.data, shape, this.stride, this.offset);
  };

  proto.lo = function lo(...starts) {
    const shape = this.shape.slice();
    const stride = this.stride.slice();
    let offset = this.offset;
    for (let axis = 0; axis < dimension; axis += 1) {
      if (typeof starts[axis] !== 'number' || starts[axis] < 0) continue;
      const start = starts[axis] | 0;
      offset += stride[axis] * start;
      shape[axis] -= start;
    }
    return construct(this.data, shape, stride, offset);
  };

  proto.step = function step(...steps) {
    const shape = this.shape.slice();
    const stride = this.stride.slice();
    let offset = this.offset;
    for (let axis = 0; axis < dimension; axis += 1) {
      if (typeof steps[axis] !== 'number') continue;
      const amount = steps[axis] | 0;
      if (amount < 0) {
        offset += stride[axis] * (shape[axis] - 1);
        shape[axis] = Math.ceil(-shape[axis] / amount);
      } else {
        shape[axis] = Math.ceil(shape[axis] / amount);
      }
      stride[axis] *= amount;
    }
    return construct(this.data, shape, stride, offset);
  };

  proto.transpose = function transpose(...axes) {
    const shape = new Array(dimension);
    const stride = new Array(dimension);
    for (let axis = 0; axis < dimension; axis += 1) {
      const source = axes[axis] === undefined ? axis : axes[axis] | 0;
      shape[axis] = this.shape[source];
      stride[axis] = this.stride[source];
    }
    return construct(this.data, shape, stride, this.offset);
  };

  proto.pick = function pick(...indices) {
    if (dimension === 0) return cachedConstructors[dtype][0](this.data);
    const shape = [];
    const stride = [];
    let offset = this.offset;
    for (let axis = 0; axis < dimension; axis += 1) {
      if (typeof indices[axis] === 'number' && indices[axis] >= 0) {
        offset = (offset + this.stride[axis] * indices[axis]) | 0;
      } else {
        shape.push(this.shape[axis]);
        stride.push(this.stride[axis]);
      }
    }
    return cachedConstructors[dtype][shape.length + 1](this.data, shape, stride, offset);
  };

  return construct;
}

function ndarray(data, shape, stride, offset) {
  if (data === undefined) {
    while (cachedConstructors.array.length < 1) cachedConstructors.array.push(compileConstructor('array', -1));
    return cachedConstructors.array[0]([]);
  }
  if (typeof data === 'number') data = [data];
  if (shape === undefined) shape = [data.length];
  const dimension = shape.length;
  if (stride === undefined) {
    stride = new Array(dimension);
    for (let axis = dimension - 1, size = 1; axis >= 0; axis -= 1) {
      stride[axis] = size;
      size *= shape[axis];
    }
  }
  if (offset === undefined) {
    offset = 0;
    for (let axis = 0; axis < dimension; axis += 1) {
      if (stride[axis] < 0) offset -= (shape[axis] - 1) * stride[axis];
    }
  }
  const dtype = arrayDType(data);
  const constructors = cachedConstructors[dtype];
  while (constructors.length <= dimension + 1) constructors.push(compileConstructor(dtype, constructors.length - 1));
  return constructors[dimension + 1](data, shape, stride, offset);
}

module.exports = ndarray;
