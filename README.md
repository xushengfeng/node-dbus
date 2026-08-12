# myde-dbus

一个使用 TypeScript 编写的、基于 Node.js 原生 Unix Socket 的 D-Bus 客户端和服务端通信库。

本库直接在 Unix Socket 上通过协议与 D-Bus daemon 通信，不需要依赖繁重的 C/C++ 编译过程，在现代 JavaScript / TypeScript 环境中非常轻量且易于使用。

## 特性

- **纯 JavaScript / TypeScript 实现**：无需编译原生 D-Bus 的 C 扩展绑定。
- **支持 ESM 与 CommonJS**：双模块格式发布，可在任意环境使用。
- **完善的客户端 API**：轻松查找服务、调用方法、读写属性，以及监听总线信号。
- **完善的服务端 API**：暴露并发布自己的 D-Bus 服务、对象、方法，也可以主动发送信号。
- **强类型支持**：提供完整的 TypeScript 类型推断和约束。

## 安装

```bash
npm install myde-dbus
```

_注意：本库支持两种 Unix Socket 实现方式：Node.js 原生 `net.Socket`（推荐）或 `myde-unix-socket`。_

## 快速使用

### 客户端（Client）示例

#### 使用 Node.js 原生 Socket（推荐）

```typescript
import net from "net";
import { dbusClient, dbusIO, createNodeSocketAdapter } from "myde-dbus";

async function main() {
    // 使用 Node.js 原生 net.Socket
    const nodeSocket = new net.Socket();
    const adapter = createNodeSocketAdapter(nodeSocket);

    // 连接到系统总线或用户会话总线
    nodeSocket.connect("/run/user/1000/bus");

    // 等待连接完成
    await new Promise((resolve) => nodeSocket.on("connect", resolve));

    // 初始化 IO 并自动进行身份验证连接
    const io = new dbusIO({ socket: adapter });
    await io.connect();

    const client = new dbusClient({ io });

    // 依次获取: 服务 (Service) -> 对象路径 (Object Path) -> 接口 (Interface)
    const service = await client.getService("org.freedesktop.DBus");
    const obj = await service.getObject("/org/freedesktop/DBus");
    const iface = await obj.getInterface("org.freedesktop.DBus");

    // 调用无参方法，返回元组需解构
    const [names] = await iface.call("ListNames").as<"as">();
    console.log("总线上的所有服务名称:", names);
}

main().catch(console.error);
```

#### 使用 myde-unix-socket

将提供fd传输特性，部分dbus协议可能需要


```shell
npm install myde-unix-socket
```

```typescript
import { dbusClient, dbusIO } from "myde-dbus";
import { USocket } from "myde-unix-socket";

async function main() {
    const socket = new USocket();

    // 连接到系统总线或用户会话总线
    await new Promise((resolve) => socket.connect("/run/user/1000/bus", resolve));

    // 初始化 IO 并自动进行身份验证连接
    const io = new dbusIO({ socket });
    await io.connect();

    const client = new dbusClient({ io });

    // 依次获取: 服务 (Service) -> 对象路径 (Object Path) -> 接口 (Interface)
    const service = await client.getService("org.freedesktop.DBus");
    const obj = await service.getObject("/org/freedesktop/DBus");
    const iface = await obj.getInterface("org.freedesktop.DBus");

    // 调用无参方法，返回元组需解构
    const [names] = await iface.call("ListNames").as<"as">();
    console.log("总线上的所有服务名称:", names);

    // 监听信号（回调参数是展开的，不是元组）
    const unsubscribe = await iface.on<"sss">("NameOwnerChanged", (name, oldOwner, newOwner) => {
        console.log(`NameOwnerChanged 事件: ${name} | ${oldOwner} -> ${newOwner}`);
    });
}

main().catch(console.error);
```

### 服务端（Server）示例


```typescript
import net from "net";
import { dbusServer, dbusIO, createNodeSocketAdapter, serverReturn } from "myde-dbus";

async function main() {
    // 使用 Node.js 原生 net.Socket
    const nodeSocket = new net.Socket();
    const adapter = createNodeSocketAdapter(nodeSocket);

    // 连接到系统总线或用户会话总线
    nodeSocket.connect("/run/user/1000/bus");

    // 等待连接完成
    await new Promise((resolve) => nodeSocket.on("connect", resolve));

    const io = new dbusIO({ socket: adapter });
    await io.connect();

    // 初始化 Server 并申请注册总线名称
    const server = new dbusServer(io, "com.my.CustomService");
    await server.init();

    // 对外暴露方法，返回 serverReturn(签名, ...参数)
    server.addObject("/com/my/CustomObject", "com.my.CustomInterface", {
        Echo: (text: string) => {
            return serverReturn("s", text);
        },
        Add: (a: number, b: number) => {
            return serverReturn("i", a + b);
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

详见[AGENTS.md](./AGENTS.md)
