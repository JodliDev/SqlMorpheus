import {ColumnInfo} from "./ColumnInfo.ts";
import {ForeignKeyInfo} from "./ForeignKeyInfo.ts";

export interface TableStructure {
	table: string
	primaryKey?: string
	columns: ColumnInfo[]
	foreignKeys?: ForeignKeyInfo[]
}