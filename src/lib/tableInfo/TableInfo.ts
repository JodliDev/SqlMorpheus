import {ForeignKeyInfo} from "../typings/ForeignKeyInfo.ts";
import {BackendTable, Class} from "../typings/BackendTable.ts";

export const TABLE_INFO_PROPERTY_NAME = "__tableInfo";

export default interface TableInfo {
	primaryKey?: string;
	foreignKeys?: ForeignKeyInfo[];
}

export function getTableInfo<T extends BackendTable>(table: Class<T>): TableInfo {
	const anyTable = table as any;
	if(!anyTable.hasOwnProperty(TABLE_INFO_PROPERTY_NAME)) {
		Object.defineProperty(table, TABLE_INFO_PROPERTY_NAME, {
			value: {primaryKey: "", foreignKeys: []} satisfies TableInfo,
			writable: false
		});
	}
	return anyTable[TABLE_INFO_PROPERTY_NAME];
}