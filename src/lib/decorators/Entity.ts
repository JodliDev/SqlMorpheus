import {BackendTable, Class} from "../typings/BackendTable.ts";

export default function Entity<T extends BackendTable>(tableName: string, primaryKey: keyof T) {
	return (table: Class<T>) => {
		Object.defineProperty(table, "name", {value: tableName, writable: false});
		Object.defineProperty(table, primaryKeyPropertyName, {value: primaryKey, writable: false});
	}
}

export const primaryKeyPropertyName = "__primaryKey";
export function getPrimaryKey<T extends BackendTable>(table: Class<T>): keyof T {
	return (table as never)[primaryKeyPropertyName];
}