export type Class<T> = new(...args: never[]) => T;

/**
 * This does nothing. It mainly exists in case we want to filter class types in the future
 */
export type BackendTable = {
	[key: string]: any,
}