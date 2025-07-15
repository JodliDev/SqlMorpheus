import {ForeignKeyInfo} from "../typings/ForeignKeyInfo.ts";
import {BackendTable, Class} from "../typings/BackendTable.ts";

export const TABLE_INFO_PROPERTY_NAME = Symbol("tableInfo");

export default interface TableInfo {
	primaryKey?: string;
	foreignKeys?: ForeignKeyInfo[];
}

export function getTableInfo<T extends BackendTable>(table: Class<T>): TableInfo {
	if(!table.hasOwnProperty(Symbol.metadata))
		table[Symbol.metadata] = {};
	return getTableInfoFromMetadata(table[Symbol.metadata]!);
}

export function getTableInfoFromMetadata(metadata: Record<PropertyKey, unknown>): TableInfo {
	if(!metadata[TABLE_INFO_PROPERTY_NAME])
		metadata[TABLE_INFO_PROPERTY_NAME] = {primaryKey: "", foreignKeys: []} satisfies TableInfo;
	
	return metadata[TABLE_INFO_PROPERTY_NAME]!;
}