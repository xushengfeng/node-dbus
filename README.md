# node-dbus

一个使用 TypeScript 编写的、基于 Node.js 原生 Unix Socket 的 D-Bus 客户端和服务端通信库。

本库直接在 Unix Socket 上通过协议与 D-Bus daemon 通信，不需要依赖繁重的 C/C++ 编译过程（除了底层的 `myde-unix-socket` 支持外），在现代 JavaScript / TypeScript 环境中非常轻量且易于使用。

## 特性

- **纯 JavaScript / TypeScript 实现**：无需编译原生 D-Bus 的 C 扩展绑定。
- **支持 ESM 与 CommonJS**：双模块格式发布，可在任意环境使用。
- **完善的客户端 API**：轻松查找服务、调用方法、读写属性，以及监听总线信号。
- **完善的服务端 API**：暴露并发布自己的 D-Bus 服务、对象、方法，也可以主动发送信号。
- **强类型支持**：提供完整的 TypeScript 类型推断和约束。

## 安装

```bash
npm install node-dbus myde-unix-socket
```

_注意：本库需要使用 `myde-unix-socket` 建立底层的 Unix Domain Socket 链接。_

## 快速使用

### 客户端（Client）示例

```typescript
import { dbusClient, dbusIO } from "node-dbus";
import { USocket } from "myde-unix-socket";

async function main() {
    const socket = new USocket();

    // 连接到系统总线或用户会话总线
    await new Promise((resolve) => socket.connect("/run/user/1000/bus", resolve));

    // 简易外部身份验证 (External Auth)
    const uid = process.getuid().toString();
    const encodedUid = Buffer.from(uid).toString("hex");
    socket.write(Buffer.from(`\0AUTH EXTERNAL ${encodedUid}\r\nBEGIN\r\n`));

    // 初始化 IO 并创建客户端
    const io = new dbusIO({ socket });
    const client = new dbusClient({ io });

    // 依次获取: 服务 (Service) -> 对象路径 (Object Path) -> 接口 (Interface)
    const service = await client.getService("org.freedesktop.DBus");
    const obj = await service.getObject("/org/freedesktop/DBus");
    const iface = await obj.getInterface("org.freedesktop.DBus");

    // 调用无参方法
    const response = await iface.call("ListNames");
    console.log("总线上的所有服务名称:", response.getBody()[0]);

    // 监听信号 (支持返回异步取消订阅函数)
    const unsubscribe = await iface.on("NameOwnerChanged", (name, oldOwner, newOwner) => {
        console.log(`NameOwnerChanged 事件: ${name} | ${oldOwner} -> ${newOwner}`);
    });
}

main().catch(console.error);
```

### 服务端（Server）示例

```typescript
import { dbusServer, dbusIO } from "node-dbus";
import { USocket } from "myde-unix-socket";

async function main() {
    const socket = new USocket();
    await new Promise((resolve) => socket.connect("/run/user/1000/bus", resolve));

    const uid = process.getuid().toString();
    const encodedUid = Buffer.from(uid).toString("hex");
    socket.write(Buffer.from(`\0AUTH EXTERNAL ${encodedUid}\r\nBEGIN\r\n`));

    const io = new dbusIO({ socket });

    // 初始化 Server 并申请注册总线名称
    const server = new dbusServer(io, "com.my.CustomService");
    await server.init();

    // 对外暴露方法
    server.addObject("/com/my/CustomObject", "com.my.CustomInterface", {
        Echo: (text: string) => {
            // 返回输入值
            return text;
        },
        Add: (a: number, b: number) => {
            // 返回两数之和
            return a + b;
        },
    });

    // 主动发出一条信号
    await server.emitSignal(
        "/com/my/CustomObject",
        "com.my.CustomInterface",
        "MySignal",
        "s", // 签名类型(字符串)
        ["Hello World!"], // 参数
    );

    console.log("D-Bus 服务已启动...");
}

main().catch(console.error);
```

## API 参考文档

### `dbusClient`

客户端连接的顶级入口。

- `getService(name: string)`: 查找并获取一个总线服务。

### `dbusInterface`

代表一个远程对象上的指定接口，用于发号施令和接收信号。

- `call(method: string, signature?: string, ...args: unknown[])`: 向指定接口发起一个 D-Bus 方法调用。
- `get(property: string)`: 读取某项 D-Bus 属性。
- `set(property: string, value: unknown, signature: string)`: 设置某项 D-Bus 属性。
- `getAll()`: 批量获取对象上的所有属性字典。
- `on(signal: string, callback: Function)`: 订阅 D-Bus 信号监听。返回一个包含取消订阅逻辑的 `Promise`。

### `dbusServer`

服务端控制层，用于注册和暴露本地的方法。

- `init()`: 向守护进程申请并绑定总线服务名称，且注册全局消息路由监听机制。
- `addObject(path: string, interface: string, methods: Record<string, Function>)`: 在指定路径和接口上挂载本地方法供外部调用。
- `removeObject(path: string, interface?: string)`: 卸载指定的对象或接口。
- `emitSignal(path: string, interface: string, name: string, signature?: string, args?: unknown[])`: 从当前服务端向外广播一条 D-Bus 信号。
