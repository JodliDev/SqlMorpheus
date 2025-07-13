import {Class, BackendTable} from "./BackendTable.ts";
import {ColumnInfo} from "./ColumnInfo.ts";
import {ForeignKeyInfo} from "./ForeignKeyInfo.ts";

export interface TableStructure<T extends BackendTable> {
	table: Class<T>
	primaryKey?: keyof T
	columns: ColumnInfo[]
	foreignKeys?: ForeignKeyInfo[]
}