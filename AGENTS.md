# AGENTS.md

## 项目概述

这是一个 Node.js 的 D-Bus 协议实现库（`myde-dbus`），提供 D-Bus 消息的编码/解码、客户端/服务端通信功能。

## 技术栈

- **语言**: TypeScript
- **构建工具**: Vite + vite-plugin-dts
- **测试框架**: Vitest
- **包管理器**: pnpm
- **运行时**: Node.js
- 格式化与lint：Biome

## 项目结构

```
src/
├── auth.ts              # D-Bus EXTERNAL 认证
├── client.ts            # D-Bus 客户端（dbusClient, dbusService, dbusObject, dbusInterface 等）
├── codec.ts             # D-Bus wire format 编解码器（Codec, Decoder）
├── dbus.ts              # D-Bus I/O 管理器（dbusIO）
├── dbus_type.ts         # D-Bus 类型系统（类型签名解析）
├── index.ts             # 模块入口
├── message.ts           # D-Bus 消息结构（dbusMessage）
├── node-socket-adapter.ts # Node.js socket 适配器
├── server.ts            # D-Bus 服务端（dbusServer）
└── types.ts             # 基础类型定义（Endian, MessageType, HeaderFieldCode 等）
```

## 常用命令

- **构建**: `pnpm build` 或 `npm run build`（执行 `npx tsc -p tsconfig.build.json && vite build`）
- **测试**: `pnpm test` 或 `npm run test`（执行 `npx vitest run`）
- **类型检查**: `npx tsc --noEmit`

## 代码规范

- 使用 JSDoc 注释所有导出的类、接口、类型和方法
- 使用中文编写 JSDoc 注释
- 保持 TypeScript 严格模式
- 构建时自动生成 `.d.ts` 类型声明文件（通过 vite-plugin-dts）

## D-Bus 协议要点

### 签名（Signature）是核心

D-Bus 的类型签名（Signature）是整个库的类型推导基石。本库通过 TypeScript 泛型将签名字符串映射为具体类型，**修改或新增涉及签名的代码时必须确保类型推导链路完整**。

- `dbus_type.ts` 中的 `ParseNext` 是递归解析器，将签名字符串逐字符解析为 TS 类型
- `call()`、`serverReturn()`、`dbusVariant()` 等方法都通过泛型参数 `T extends string` 接收签名
- 签名错误会导致编译期类型推导失败或运行时编解码错误

### 参数和返回值多为元组

D-Bus 方法调用的参数和返回值**普遍是列表（元组）形式**，即使只有一个值也包裹在元组中。这是因为 D-Bus 协议的 method return 和 signal 的 body 是值数组。

- `DBusTypes<T>` 实际是 `DBusType<(T)>`，即将签名包装为结构体后解析，结果始终是元组
- 例如 `as<"s">()` 返回 `[string]`，`as<"a{sv}">()` 返回 `[DbusDict<string, DbusVar<string>>]`
- `Hello()` 返回 `Promise<[string]>`，`ListNames()` 返回 `Promise<[string[]]>`
- 这与 D-Bus 协议一致：reply body 是一个值列表，即使只有一个返回值也是 `[value]`

### 类型签名速查

| 签名 | TypeScript 类型 | 说明 |
|------|----------------|------|
| `y` | `number` | BYTE |
| `b` | `boolean` | BOOLEAN |
| `n`/`q` | `number` | INT16/UINT16 |
| `i`/`u` | `number` | INT32/UINT32 |
| `x`/`t` | `bigint` | INT64/UINT64 |
| `d` | `number` | DOUBLE |
| `s` | `string` | STRING |
| `o` | `string` | OBJECT_PATH |
| `g` | `string` | SIGNATURE |
| `v` | `DbusVar<T>` | VARIANT |
| `a{KV}` | `DbusDict<K,V>` | DICT |
| `aT` | `Array<T>` | ARRAY |
| `(TT)` | `[T, T, ...]` | STRUCT |

### Variant（v）的解析和构建

Variant 是 D-Bus 的动态类型，运行时才确定内部值的类型。本库中 variant 表示为 `DbusVar<T>`：

```ts
type DbusVar<T extends string> = {
  signature: T;   // 内部值的类型签名
  value: DBusType<T>; // 签名对应的值
};
```

**构建 variant** 使用 `dbusVariant()` 函数：

```ts
import { dbusVariant } from "myde-dbus";

// 创建一个内部类型为 string 的 variant
const v = dbusVariant<"s">("s", "hello");
// => { signature: "s", value: "hello" }

// 常见场景：构建 DICT<STRING, VARIANT>（即 a{sv}）
const dict: DBusType<"a{sv}"> = [
  ["name", dbusVariant<"s">("s", "Alice")],
  ["age", dbusVariant<"i">("i", 30)],
];
```

**解析 variant** 时，`as<"v">()` 返回 `DbusVar<string>`，内部签名是运行时字符串：

```ts
const [result] = await iface.get<"v">("Features");
// result: DbusVar<string>，需要根据 result.signature 进一步处理
```

**常见签名模式**：

| 签名 | 含义 | TS 类型 |
|------|------|---------|
| `v` | 单个 variant | `DbusVar<string>` |
| `a{sv}` | 字典，string -> variant | `DbusDict<string, DbusVar<string>>` |
| `a{sv}v` | 字典 + variant | `[DbusDict<string, DbusVar<string>>, DbusVar<string>]` |

### Dict（a{KV}）是元组数组而非对象

D-Bus 的 dict 在本库中表示为 `DbusDict<K, V>` 即 `[K, V][]`，**不是** `Record<K, V>` 或 `{}`。这是 D-Bus wire format 决定的——dict 编码为 entry 数组，每个 entry 是 `(KV)` 结构体。

```ts
type DbusDict<K, V> = [K, V][];
```

**构建 dict**：

```ts
// a{sv} - 常见的 string -> variant 字典
const dict: DBusType<"a{sv}"> = [
  ["name", dbusVariant<"s">("s", "Alice")],
  ["age", dbusVariant<"i">("i", 30)],
];

// a{is} - int -> string 字典
const dict2: DBusType<"a{is}"> = [
  [1, "one"],
  [2, "two"],
];
```

**使用 `as DbusVar<T>` 约束 variant 类型**：

当从 dict 中取 variant 值（`a{sv}`）时，`dbusVariant()` 或解析得到的 variant 类型是 `DbusVar<string>`，可用 `as DbusVar<T>` 收窄以获得具体类型：

```ts
import { type DbusVar } from "myde-dbus";

// 获取 a{sv} 类型的属性
const [props] = await iface.call("GetAll", "s", "org.example.Iface").as<"a{sv}">();

// props 是 [string, DbusVar<string>][]
for (const [key, val] of props) {
  // val: DbusVar<string>，只知道 signature 是 string
  if (val.signature === "s") {
    const strVal = (val as DbusVar<"s">).value; // string
  }
  if (val.signature === "i") {
    const intVal = (val as DbusVar<"i">).value; // number
  }
}

// 属性变化监听中，已知 changedProperties 是 a{sv}
// v: DbusVar<string>，可直接用 v.value 获取值
callback(
  Object.fromEntries(changedProperties.map(([k, v]) => [k, v.value])),
  invalidatedProperties,
);
```

### 其他要点

- 消息使用小端序（Little Endian）传输
- 结构体和数组有对齐要求（参考 `align()` 函数）
- 认证使用 EXTERNAL 机制，发送进程 UID

## 客户端常用方法

客户端使用层级结构：`dbusClient` → `dbusService` → `dbusObject` → `dbusInterface`。

### 参数传递方式区分

| 方法 | 参数形式 | 说明 |
|------|---------|------|
| `call(method, sig, ...args)` | `...args: DBusTypes<T>` | **展开**，逐个传参 |
| `get(property)` | 返回 `Promise<DBusTypes<T>>` | 返回**元组**，需解构 |
| `set(property, value, sig)` | `value: DBusTypes<T>` | **元组**，传入数组 |
| `on(signal, callback)` | `callback: (...args: DBusTypes<T>) => void` | 回调参数**展开** |
| `dbusVariant(sig, ...values)` | `...values: DBusTypes<T>` | **展开**，逐个传参 |
| `serverReturn(sig, ...args)` | `...args: DBusTypes<T>` | **展开**，逐个传参 |

**关键区别**：
- `...DBusTypes<T>`（展开）：传入独立参数，如 `call("M", "su", "name", 0)`
- `DBusTypes<T>`（元组）：传入数组，如 `set("Name", ["value"], "s")`

### call() - 调用 D-Bus 方法

```ts
const client = new dbusClient({ io });
const service = await client.getService("org.freedesktop.DBus");
const obj = await service.getObject("/org/freedesktop/DBus");
const iface = await obj.getInterface("org.freedesktop.DBus");

// call(方法名, 签名, ...参数) - 参数展开
// 返回对象有两个方法：
//   .as<R>() - 发送并等待返回，返回元组
//   .await() - 发送但不关心返回值

// 有参数的方法调用
const [result] = await iface.call("RequestName", "su", "com.example.App", 0).as<"u">();

// 无参数的方法调用
const [names] = await iface.call("ListNames").as<"as">();

// 不需要返回值
await iface.call("AddMatch", "s", "type='signal'").await();
```

### get() / set() / getAll() - 属性操作

```ts
// 获取属性，返回元组
const [features] = await iface.get<"v">("Features");

// 设置属性，value 是元组（DBusTypes<T>），不是展开参数
await iface.set("Name", ["new-name"], "s");

// 获取所有属性，返回 Record<string, unknown>
const props = await iface.getAll();
```

### on() - 监听信号

```ts
// on<签名>(信号名, 回调)
// 回调参数是展开的（...args: DBusTypes<T>），不是元组
// 返回取消监听的函数
const off = await iface.on<"sss">("NameOwnerChanged", (name, oldOwner, newOwner) => {
  console.log(`${name}: ${oldOwner} -> ${newOwner}`);
});

// 取消监听
off();
```

### propertiesChanged() - 监听属性变化

```ts
const off = await iface.propertiesChanged((changed, invalidated) => {
  // changed: Record<string, unknown>，变化的属性
  // invalidated: string[]，失效的属性名
  for (const [key, value] of Object.entries(changed)) {
    console.log(`${key} changed:`, value);
  }
});
```

### dbusMetaInterface - D-Bus 总线管理

```ts
const meta = await client.getMetaInterface();

// 获取当前连接名
const [name] = await meta.Hello(); // 如 ":1.42"

// 请求总线名
const [result] = await meta.RequestName("com.example.App", 0);

// 获取所有总线名
const [names] = await meta.ListNames();

// 监听总线名变化
const off = await meta.onNameOwnerChanged((name, old, new_) => { ... });
```

## 测试

测试文件位于 `test/` 目录，使用 Vitest 运行。测试覆盖：
- 编解码器（codec.test.ts）
- 客户端（client.test.ts）
- 服务端（server.test.ts）
- 消息类型（dbus_type.test-d.ts）
- Socket 适配器（node-socket-adapter.test.ts）
