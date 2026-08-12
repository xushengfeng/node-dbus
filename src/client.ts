import type { dbusIO } from "./dbus";
import type { DBusTypes } from "./dbus_type";
import { dbusMessage } from "./message";
import { MessageType } from "./types";

/** D-Bus 客户端操作的内部配置 */
type dbusClientOp = {
	io: dbusIO;
	destination: string;
	path: string;
	interface: string;
};

/** D-Bus 客户端，用于获取服务和元接口 */
export class dbusClient {
	op: Omit<dbusClientOp, "destination" | "path" | "interface">;
	/**
	 * 创建 D-Bus 客户端
	 * @param op - 客户端配置，包含 I/O 管理器
	 */
	constructor(op: typeof dbusClient.prototype.op) {
		this.op = { ...op };
	}
	/**
	 * 获取 D-Bus 服务
	 * @param name - 服务名，如 "org.freedesktop.DBus"
	 * @returns D-Bus 服务对象
	 */
	async getService(name: string) {
		return new dbusService({ ...this.op, destination: name });
	}
	/**
	 * 获取 D-Bus 元接口（org.freedesktop.DBus）
	 * @returns D-Bus 元接口对象
	 */
	async getMetaInterface() {
		const obj = await (await this.getService("org.freedesktop.DBus")).getObject(
			"/org/freedesktop/DBus",
		);
		const iface = await obj.getInterface("org.freedesktop.DBus");
		return new dbusMetaInterface(iface);
	}
}

/** D-Bus 服务，代表一个总线名下的对象集合 */
export class dbusService {
	op: Omit<dbusClientOp, "path" | "interface">;
	/**
	 * 创建 D-Bus 服务
	 * @param op - 服务配置
	 */
	constructor(op: typeof dbusService.prototype.op) {
		this.op = { ...op };
	}
	/**
	 * 获取服务下的对象
	 * @param path - 对象路径，如 "/org/freedesktop/DBus"
	 * @returns D-Bus 对象
	 */
	async getObject(path: string) {
		if (!path.startsWith("/")) {
			throw new Error("Object path must start with '/'");
		}
		return new dbusObject({ ...this.op, path });
	}
}

/** D-Bus 对象，代表一个对象路径下的接口集合 */
export class dbusObject {
	op: Omit<dbusClientOp, "interface">;
	private introspectable: dbusInterfaceRaw;
	private peer: dbusInterfaceRaw;
	private properties: dbusInterfaceRaw;
	/**
	 * 创建 D-Bus 对象
	 * @param op - 对象配置
	 */
	constructor(op: typeof dbusObject.prototype.op) {
		this.op = { ...op };
		this.introspectable = new dbusInterfaceRaw({
			...this.op,
			interface: "org.freedesktop.DBus.Introspectable",
		});
		this.peer = new dbusInterfaceRaw({
			...this.op,
			interface: "org.freedesktop.DBus.Peer",
		});
		this.properties = new dbusInterfaceRaw({
			...this.op,
			interface: "org.freedesktop.DBus.Properties",
		});
	}
	/**
	 * 获取对象下的接口
	 * @param name - 接口名，如 "org.freedesktop.DBus.Properties"
	 * @returns D-Bus 接口对象
	 */
	async getInterface(name: string) {
		return new dbusInterface(
			{ ...this.op, interface: name },
			{
				introspectable: this.introspectable,
				peer: this.peer,
				properties: this.properties,
			},
		);
	}
}

/** D-Bus 原始接口，提供底层方法调用能力 */
export class dbusInterfaceRaw {
	op: dbusClientOp;
	io: dbusIO;
	/**
	 * 创建 D-Bus 原始接口
	 * @param op - 接口配置
	 */
	constructor(op: dbusClientOp) {
		this.op = { ...op };
		this.io = op.io;
	}
	/**
	 * 调用 D-Bus 方法
	 * @param method - 方法名
	 * @param signature - 参数类型签名
	 * @param args - 方法参数
	 * @returns 包含 await 和 as 方法的结果对象
	 */
	call<T extends string = "">(
		method: string,
		signature: T = "" as T,
		// @ts-expect-error
		...args: DBusTypes<T>
	) {
		const msg = new dbusMessage();
		msg.setDestination(this.op.destination);
		msg.setPath(this.op.path);
		msg.setInterface(this.op.interface);
		msg.setMember(method);
		if (signature) {
			msg.setSignature(signature);
			// @ts-expect-error
			msg.setBody(args);
		}
		const r = this.io.call(msg);

		return {
			/** 发送方法调用但不等待返回结果 */
			async await() {
				await r;
			},
			/**
			 * 发送方法调用并将返回解析为指定类型
			 * @typeParam R - 返回类型的 D-Bus 签名
			 * @returns 解析后的返回值
			 */
			async as<R extends string>(): Promise<DBusTypes<R>> {
				const response = await r;
				const body = response.getBody();
				return body as DBusTypes<R>;
			},
		};
	}
}

/** D-Bus 接口，提供方法调用、属性访问和信号监听 */
export class dbusInterface {
	op: dbusClientOp;
	io: dbusIO;
	private meta: {
		introspectable: dbusInterfaceRaw;
		peer: dbusInterfaceRaw;
		properties: dbusInterfaceRaw;
	};
	private m: dbusInterfaceRaw;
	/**
	 * 创建 D-Bus 接口
	 * @param op - 接口配置
	 * @param meta - 元接口集合（introspectable、peer、properties）
	 */
	constructor(
		op: dbusClientOp,
		meta: {
			introspectable: dbusInterfaceRaw;
			peer: dbusInterfaceRaw;
			properties: dbusInterfaceRaw;
		},
	) {
		this.op = { ...op };
		this.io = op.io;
		this.meta = meta;
		this.m = new dbusInterfaceRaw(this.op);
	}

	/**
	 * 调用 D-Bus 方法
	 * @param method - 方法名
	 * @param signature - 参数类型签名
	 * @param args - 方法参数
	 * @returns 包含 await 和 as 方法的结果对象
	 */
	call<T extends string = "">(
		method: string,
		signature: T = "" as T,
		// @ts-expect-error
		...args: DBusTypes<T>
	) {
		// @ts-expect-error
		return this.m.call(method, signature, ...args);
	}

	/**
	 * 获取属性值
	 * @param property - 属性名
	 * @typeParam T - 属性类型的 D-Bus 签名
	 * @returns 属性值
	 */
	async get<T extends string>(property: string): Promise<DBusTypes<T>> {
		const r = await this.meta.properties
			.call("Get", "ss", this.op.interface, property)
			.as<"v">();
		return r[0].value as DBusTypes<T>;
	}

	/**
	 * 设置属性值
	 * @param property - 属性名
	 * @param value - 属性值
	 * @param signature - 值的 D-Bus 类型签名
	 */
	async set<T extends string>(
		property: string,
		value: DBusTypes<T>,
		signature: T,
	): Promise<void> {
		await this.meta.properties
			.call("Set", "ssv", this.op.interface, property, { signature, value })
			.await();
	}

	/** 获取所有属性 */
	async getAll(): Promise<Record<string, unknown>> {
		const b = await this.meta.properties
			.call("GetAll", "s", this.op.interface)
			.as<"a{sv}">();
		const result: Record<string, unknown> = {};
		for (const [k, v] of b[0]) {
			result[k] = v;
		}
		return result;
	}

	/**
	 * 监听 D-Bus 信号
	 * @param signal - 信号名
	 * @param callback - 信号处理回调
	 * @returns 取消监听的函数
	 */
	async on<T extends string = "">(
		signal: string,
		// @ts-expect-error
		callback: (...args: DBusTypes<T>) => void,
	): Promise<() => void> {
		const rule = `type='signal',sender='${this.op.destination}',interface='${this.op.interface}',member='${signal}',path='${this.op.path}'`;

		const msg = new dbusMessage();
		msg.setDestination("org.freedesktop.DBus");
		msg.setPath("/org/freedesktop/DBus");
		msg.setInterface("org.freedesktop.DBus");
		msg.setMember("AddMatch");
		msg.setSignature("s");
		msg.setBody([rule]);

		await this.io.call(msg);

		const handler = (m: dbusMessage) => {
			if (
				m.getType() === MessageType.Signal &&
				m.getPath() === this.op.path &&
				m.getInterface() === this.op.interface &&
				m.getMember() === signal
			) {
				// @ts-expect-error
				callback(...m.getBody());
			}
		};

		this.io.addMessageHandler(handler);

		return async () => {
			this.io.removeMessageHandler(handler);
			const removeMsg = new dbusMessage();
			removeMsg.setDestination("org.freedesktop.DBus");
			removeMsg.setPath("/org/freedesktop/DBus");
			removeMsg.setInterface("org.freedesktop.DBus");
			removeMsg.setMember("RemoveMatch");
			removeMsg.setSignature("s");
			removeMsg.setBody([rule]);
			await this.io.call(removeMsg);
		};
	}

	/**
	 * 监听属性变化信号
	 * @param callback - 属性变化回调，接收变化的属性和失效的属性
	 * @returns 取消监听的函数
	 */
	async propertiesChanged(
		callback: (
			changedProperties: Record<string, unknown>,
			invalidatedProperties: string[],
		) => void,
	): Promise<() => void> {
		const propertiesIface = new dbusInterface(
			{ ...this.op, interface: this.meta.properties.op.interface },
			this.meta,
		);
		// todo 合并到object
		return propertiesIface.on<"sa{sv}as">(
			"PropertiesChanged",
			(interfaceName, changedProperties, invalidatedProperties) => {
				if (interfaceName !== this.op.interface) return;
				callback(
					Object.fromEntries(changedProperties.map(([k, v]) => [k, v.value])),
					invalidatedProperties,
				);
			},
		);
	}
}

/** D-Bus 元接口（org.freedesktop.DBus），提供总线管理功能 */
export class dbusMetaInterface {
	private iface: dbusInterface;
	/**
	 * 创建 D-Bus 元接口
	 * @param iface - D-Bus 接口对象
	 */
	constructor(iface: dbusInterface) {
		this.iface = iface;
	}
	/** 获取当前连接的唯一名称 */
	async Hello() {
		return await this.iface.call("Hello").as<"s">();
	}
	/**
	 * 请求总线名
	 * @param name - 要请求的总线名
	 * @param flags - 请求标志
	 */
	async RequestName(name: string, flags: number) {
		return await this.iface.call("RequestName", "su", name, flags).as<"u">();
	}
	/**
	 * 释放总线名
	 * @param name - 要释放的总线名
	 */
	async ReleaseName(name: string) {
		return await this.iface.call("ReleaseName", "s", name).as<"u">();
	}
	/**
	 * 获取指定总线名的排队所有者列表
	 * @param name - 总线名
	 */
	async ListQueuedOwners(name: string) {
		return await this.iface.call("ListQueuedOwners", "s", name).as<"as">();
	}
	/** 获取当前所有已注册的总线名 */
	async ListNames() {
		return await this.iface.call("ListNames").as<"as">();
	}
	/** 获取所有可激活的服务名 */
	async ListActivatableNames() {
		return await this.iface.call("ListActivatableNames").as<"as">();
	}
	/**
	 * 检查总线名是否有所有者
	 * @param name - 总线名
	 */
	async NameHasOwner(name: string) {
		return await this.iface.call("NameHasOwner", "s", name).as<"b">();
	}
	/**
	 * 监听总线名所有者变化
	 * @param callback - 变化回调，接收名称、旧所有者、新所有者
	 * @returns 取消监听的函数
	 */
	async onNameOwnerChanged(
		callback: (name: string, oldOwner: string, newOwner: string) => void,
	): Promise<() => void> {
		return this.iface.on<"sss">("NameOwnerChanged", callback);
	}
	/**
	 * 监听总线名丢失事件
	 * @param callback - 丢失回调
	 * @returns 取消监听的函数
	 */
	async onNameLost(callback: (name: string) => void): Promise<() => void> {
		return this.iface.on<"s">("NameLost", callback);
	}
	/**
	 * 监听总线名获取事件
	 * @param callback - 获取回调
	 * @returns 取消监听的函数
	 */
	async onNameAcquired(callback: (name: string) => void): Promise<() => void> {
		return this.iface.on<"s">("NameAcquired", callback);
	}
	/**
	 * 监听可激活服务变化事件
	 * @param callback - 变化回调
	 * @returns 取消监听的函数
	 */
	async onActivatableServicesChanged(
		callback: () => void,
	): Promise<() => void> {
		return this.iface.on("ActivatableServicesChanged", () => {
			callback();
		});
	}
	/**
	 * 启动指定服务
	 * @param name - 服务名
	 * @param flags - 启动标志
	 */
	async StartServiceByName(name: string, flags: number) {
		return await this.iface
			.call("StartServiceByName", "su", name, flags)
			.as<"u">();
	}
	/**
	 * 更新激活环境变量
	 * @param environment - 环境变量键值对
	 */
	async UpdateActivationEnvironment(environment: Record<string, string>) {
		const envArray = Object.entries(environment).map(
			([k, v]) => [k, v] as [string, string],
		);
		await this.iface
			.call("UpdateActivationEnvironment", "a{ss}", envArray)
			.await();
	}
	/**
	 * 获取总线名的所有者唯一名
	 * @param name - 总线名
	 */
	async GetNameOwner(name: string) {
		return await this.iface.call("GetNameOwner", "s", name).as<"s">();
	}
	/**
	 * 获取连接的 Unix 用户 ID
	 * @param name - 总线名
	 */
	async GetConnectionUnixUser(name: string) {
		return await this.iface.call("GetConnectionUnixUser", "s", name).as<"u">();
	}
	/**
	 * 获取连接的 Unix 进程 ID
	 * @param name - 总线名
	 */
	async GetConnectionUnixProcessID(name: string) {
		return await this.iface
			.call("GetConnectionUnixProcessID", "s", name)
			.as<"u">();
	}
	/**
	 * 获取连接的凭据信息
	 * @param name - 总线名
	 */
	async GetConnectionCredentials(name: string) {
		return await this.iface
			.call("GetConnectionCredentials", "s", name)
			.as<"a{sv}">();
	}
	/**
	 * 获取连接的 ADT 审计会话数据
	 * @param name - 总线名
	 */
	async GetAdtAuditSessionData(name: string) {
		return await this.iface
			.call("GetAdtAuditSessionData", "s", name)
			.as<"a{sv}">();
	}
	/**
	 * 获取连接的 SELinux 安全上下文
	 * @param name - 总线名
	 */
	async GetConnectionSELinuxSecurityContext(name: string) {
		return await this.iface
			.call("GetConnectionSELinuxSecurityContext", "s", name)
			.as<"ay">();
	}
	/**
	 * 添加匹配规则以接收信号
	 * @param matchRule - 匹配规则字符串
	 */
	async AddMatch(matchRule: string) {
		await this.iface.call("AddMatch", "s", matchRule).await();
	}
	/**
	 * 移除匹配规则
	 * @param matchRule - 匹配规则字符串
	 */
	async RemoveMatch(matchRule: string) {
		await this.iface.call("RemoveMatch", "s", matchRule).await();
	}
	/** 获取 D-Bus 守护进程的唯一 ID */
	async GetId() {
		return await this.iface.call("GetId").as<"s">();
	}
	/** 获取 D-Bus 守护进程支持的特性列表 */
	async Features() {
		return await this.iface.call("Features").as<"as">();
	}
}
