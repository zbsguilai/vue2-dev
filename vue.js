


export function Vue(options = {}) {
	this._init(options)
}
Vue.prototype._init = function (options) {
	this.$options = options;
	//假设这里就是一个el，已经querySelector
	this.$el = options.el;
	this.$data = options.data;
	this.$methods = options.methods;
	// beforeCreate--initState--initData
	proxy(this, this.$data)
	//observer()
	observer(this.$data)//对data监听，对data中数据变成响应式
	new Compiler(this);
}

// class Vue {
// 	constructor(options) {
// 		this.$options = options;
// 		this.$el = options.el;
// 		this.$data = options.data;
// 		this.$methods = options.$methods;
// 		proxy(this, this.$data)
// 	}
// }

// 把this.$data 代理到 this
//this.$data.message--> this.message
function proxy(target, data) {
	Object.keys(data).forEach(key => {
		Object.defineProperty(target, key, {
			enumerable: true,
			configurable: true,
			get() {
				return data[key]
			},
			set(newValue) {
				//需要考虑NaN的情况,故需要修改以下代码
				// if (data[key] !== newValue) data[key] = newValue
				if (!isSameVal(data[key], newValue)) data[key] = newValue;
			},
		})
	})
}


function observer(data) {
	new Observer(data)
}
// 对data监听，把数据变成响应式
class Observer {

	constructor(data) {
		this.walk(data)
	}

	walk(data) {
		if (data && typeof data === 'object') {
			Object.keys(data).forEach(key => this.defineReactive(data, key, data[key]))
		}
	}
	//把每一个data里面的数据收集起来
	defineReactive(obj, key, value) {
		let that = this;
		this.walk(value);//递归
		let dep = new Dep();

		Object.defineProperty(obj, key, {
			configurable: true,
			enumerable: true,
			get() {
				console.log('22222')
				// 4一旦获取数据，把watcher收集起来，给每一个数据加一个依赖的收集
				//5num中的dep，就有了这个watcher
				console.log(dep, 'dep')
				console.log(Dep.target, 'Dep.target')
				Dep.target && dep.add(Dep.target)
				return value
			},
			set(newValue) {
				console.log('1111111')
				if (!isSameVal(value, newValue)) {
					value = newValue;
					//添加的新值也不是响应式的,所以需要调用walk 
					that.walk(newValue);
					//有了watcher之后，修改时就可以调用update方法 
					//6 重新set时就通知更新
					dep.notify()
				}
			}
		})
	}
}

// watcher和dep的组合就是发布订阅者模式
// 视图更新
// 数据改变，视图才会更新，需要去观察
// 1 new Watcher(vm, 'num', () => { 更新视图上的num显示 })
class Watcher {
	constructor(vm, key, cb) {
		this.vm = vm;
		this.key = key;
		this.cb = cb;//试图更新的函数

		Dep.target = this;//2.全局变量，放的就是Watcher自己
		//
		console.log(vm[key], 'vm[key]')
		this.__old = vm[key];//3.一旦进行了这句赋值。就会触发这个值得getter，会执行Observer中的get方法
		Dep.target = null;
	}
	//执行所有的cb函数
	update() {
		console.log('4444444')
		let newVal = this.vm[this.key];
		if (!isSameVal(newVal, this.__old)) this.cb(newVal)
	}
}
// 每一个数据都要有一个 dep 的依赖
class Dep {
	constructor() {
		this.watchers = new Set();
	}
	add(watcher) {
		console.log(watcher, 'watcher')
		if (watcher && watcher.update) this.watchers.add(watcher)
	}
	//7让所有的watcher执行update方法
	notify() {
		console.log('333333')
		console.log(this.watchers, 'watchers')
		this.watchers.forEach(watc => watc.update())
	}
}

//递归编译#app下的所有节点内容
class Compiler {
	constructor(vm) {
		this.el = vm.$el;
		this.vm = vm;
		this.methods = vm.$methods;
		// console.log(vm.$methods, 'vm.$methods')
		this.compile(vm.$el)
	}
	compile(el) {
		let childNodes = el.childNodes;
		//类数组
		Array.from(childNodes).forEach(node => {
			console.log(node.nodeType, 'node.nodeType')
			if (node.nodeType === 3) {
				this.compileText(node)
			} else if (node.nodeType === 1) {
				this.compileElement(node)
			}
			//递归 
			if (node.childNodes && node.childNodes.length) this.compile(node)
		})
	}
	// 文本节点处理
	compileText(node) {
		//匹配出来 {{massage}} 
		let reg = /\{\{(.+?)\}\}/;
		let value = node.textContent;
		console.log(node.textContent, 'node.textContent')
		console.log(reg.test(value), 'reg.test(value)')
		if (reg.test(value)) {
			let key = RegExp.$1.trim()
			// 开始时赋值
			node.textContent = value.replace(reg, this.vm[key]);
			console.log(node.textContent, '开始时赋值')
			//添加观察者
			new Watcher(this.vm, key, val => {
				//数据改变时的更新
				node.textContent = val;
			})
		}
	}
	//元素节点
	compileElement(node) {
		// console.log(node,'node')
		// console.log(node.attributes,'node.attributes')
		//简化，只做v-on，v-model的匹配
		if (node.attributes.length) {
			Array.from(node.attributes).forEach(attr => {
				let attrName = attr.name;
				if (attrName.startsWith('v-')) {
					//v-指令匹配成功可能是是v-on，v-model
					attrName = attrName.indexOf(':') > -1 ? attrName.substr(5) : attrName.substr(2)
					let key = attr.value;
					console.log(key, 'key')
					this.update(node, key, attrName, this.vm[key])
				}
			})
		}
	}

	update(node, key, attrName, value) {
		console.log('更新')
		if (attrName == "model") {
			node.value = value;
			new Watcher(this.vm, key, val => node.value = val);
			node.addEventListener('input', () => {
				this.vm[key] = node.value;
			})
		} else if (attrName == 'click') {
			// console.log(this.methods,'key')
			node.addEventListener(attrName, this.methods[key].bind(this.vm))
		}
	}
}


// 判断NaN
function isSameVal(a, b) {
	return a === b || (Number.isNaN(a) && Number.isNaN(b))
}



//邓宁-克鲁格效应
// 巨婴-绝望之谷-持续上升平原