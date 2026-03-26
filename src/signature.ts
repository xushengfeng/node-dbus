export function splitSignature(sig: string): string[] {
	const parts: string[] = [];
	let i = 0;
	while (i < sig.length) {
		const next = parseSingleSignature(sig, i);
		parts.push(sig.substring(i, next));
		i = next;
	}
	return parts;
}

function parseSingleSignature(sig: string, start: number): number {
	let i = start;
	if (i >= sig.length) return i;

	if (sig[i] === "a") {
		return parseSingleSignature(sig, i + 1);
	} else if (sig[i] === "(" || sig[i] === "{") {
		const close = sig[i] === "(" ? ")" : "}";
		i++;
		while (i < sig.length && sig[i] !== close) {
			i = parseSingleSignature(sig, i);
		}
		return i + 1;
	} else {
		return i + 1;
	}
}
