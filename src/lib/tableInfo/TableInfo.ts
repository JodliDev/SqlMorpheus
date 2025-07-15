import {ForeignKeyInfo} from "../typings/ForeignKeyInfo";
import {BackendTable, Class} from "../typings/BackendTable";

export const TABLE_INFO_PROPERTY_NAME = Symbol("tableInfo");

export default interface TableInfo {
	primaryKey?: string;
	foreignKeys?: ForeignKeyInfo[];
}

export function getTableInfo<T extends BackendTable>(table: Class<T>): TableInfo {
	//to stay compatible with old decorator structure (see https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-2.html#decorator-metadata):
	let metadata = table[Symbol.metadata] ?? table.prototype?.[Symbol.metadata];
	
	if(!metadata) {
		metadata = {};
		table[Symbol.metadata] = metadata;
	}
	return getTableInfoFromMetadata(metadata);
}

export function getTableInfoFromMetadata(metadata: Record<PropertyKey, unknown>): TableInfo {
	if(!metadata[TABLE_INFO_PROPERTY_NAME])
		metadata[TABLE_INFO_PROPERTY_NAME] = {primaryKey: "", foreignKeys: []} satisfies TableInfo;
	
	return metadata[TABLE_INFO_PROPERTY_NAME]!;
}