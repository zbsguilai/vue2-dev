export function Vue(options = {}) {
    this.__init(options);
}
// initMixin 
Vue.prototype.__init = function (options) {
    this.$options = options;
    // 假设这里就是一个 el， 已经 querySelector 的
    this.$el = options.el;
    this.$data = options.data;
    this.$methods = options.methods;
    // beforeCreate -- initState -- initData;
    proxy(this, this.$data);
    // observer(); 
    // Object.define...
    observer(this.$data);
    new Compiler(this);
}
// this.$data.message --> this.message
//             this   this.$data
function proxy(target, data) {
    Object.keys(data).forEach(key => {
        Object.defineProperty(target, key, {
            enumerable: true,
            configurable: true,
            get() {
                return data[key];
            },
            set(newVal) {
                // 考虑 NaN 的情况
                if (!isSameVal(data[key], newVal)) {
                    data[key] = newVal;
                }
            }
        })
    })
}

function observer(data) { new Observer(data) };

class Observer {
    constructor(data) {
        this.walk(data);
    }

    walk(data) {
        if (data && typeof data === "object") {
            Object.keys(data).forEach(key => this.defineReactive(data, key, data[key]));
        }
    }

    // 我要把每一个 data 里面的数据，收集起来。
    defineReactive(obj, key, value) {
        let that = this;
        this.walk(value);
        let dep = new Dep();
        // 带来一层。
        Object.defineProperty(obj, key, {
            configurable: true,
            enumerable: true,
            get() {
                // 4. 对于 num 来说，要执行这一句。
                // 5. num 中的 dep, 就有了这个 watcher
                // dep: [watcher, watcher ]
                Dep.target && dep.add(Dep.target);
                return value
            },
            set(newVal) {
                if (!isSameVal(value, newVal)) {
                    // 赋值进来的新值，是没有响应式的，所以我要再 walk 一次，给到响应式。
                    value = newVal;
                    that.walk(newVal);
                    // 重新set时，通知更新
                    // 6.
                    dep.notify();
                }
            }
        })
    }
}

// 视图怎么更新？
// 数据改变，视图才会更新。需要去观察
// 1. new Watcher( vm, 'num', () => {更新视图上的num显示} )
class Watcher {
    // cb: 35-36在界面的函数
    constructor(vm, key, cb) {
        this.vm = vm; // VUE 的一个实例
        this.key = key;
        this.cb = cb;

        // 2. 此时 Dep.target 作为一个全局变量理解，放的就是这个 watcher;
        Dep.target = this;
        // 3. 一旦进行了这一句赋值，是不是就触发了这个值的 getter 函数。
        this.__old = vm[key];
        // 把 Dep.target 删除。
        Dep.target = null;
    }

    // 8. 执行所有的 cb 函数。
    update() {
        let newVal = this.vm[this.key];
        if (!isSameVal(newVal, this.__old)) this.cb(newVal);
    }
}

// 每一个数据都要有一个 dep 的依赖
class Dep {
    constructor() {
        this.watchers = new Set();
    }

    add(watcher) {
        if (watcher && watcher.update) this.watchers.add(watcher);
    }

    // 7. 让所有的 watcher 执行 update 方法。
    notify() {
        this.watchers.forEach(watc => watc.update())
    }
}

class Compiler {
    constructor(vm) {
        this.el = vm.$el;
        this.vm = vm;

        this.methods = vm.$methods;
        console.log(vm.$methods, 'vm.$methods')

        this.compile(vm.$el);
    }
    // 这里是递归编译 #app 下面的所有的节点内容；
    compile(el) {
        let childNodes = el.childNodes;
        // 类数组
        Array.from(childNodes).forEach(node => {
            // 判断如果是文本节点
            if (node.nodeType === 3) {
                this.compileText(node)
            }
            // 如果是元素节点
            else if (node.nodeType === 1) {
                this.compileElement(node)
            }
            // 如果还有子节点，就递归下去。
            if (node.childNodes && node.childNodes.length) this.compile(node);
            // ...
        })
    }

    compileText(node) {
        // 匹配出来 {{massage}}
        let reg = /\{\{(.+?)\}\}/;
        let value = node.textContent;
        if (reg.test(value)) {
            let key = RegExp.$1.trim()
            // 开始时赋值。
            node.textContent = value.replace(reg, this.vm[key]);
            // 添加观察者
            new Watcher(this.vm, key, val => {
                // 数据改变时的更新
                node.textContent = val;
            })
        }
    }

    compileElement(node) {
        // 简化，只做匹配 v-on 和 v-model 的匹配
        if (node.attributes.length) {
            Array.from(node.attributes).forEach(attr => {
                let attrName = attr.name;
                if (attrName.startsWith('v-')) {
                    // v- 指令匹配成功，可能是 v-on:click 或者 v-model
                    attrName = attrName.indexOf(':') > -1 ? attrName.substr(5) : attrName.substr(2)
                    let key = attr.value;
                    // 
                    this.update(node, key, attrName, this.vm[key])
                }
            })
        }
    }

    update(node, key, attrName, value) {
        if (attrName === 'model') {
            node.value = value;
            new Watcher(this.vm, key, val => node.value = val);
            node.addEventListener('input', () => {
                this.vm[key] = node.value;
            })
        } else if (attrName === 'click') {
            console.log('点击事件-----------------')
            node.addEventListener(attrName, this.methods[key].bind(this.vm))
        }
    }
}

function isSameVal(a, b) {
    return a === b || (Number.isNaN(a) && Number.isNaN(b))
}