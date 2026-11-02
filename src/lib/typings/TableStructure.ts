import {ColumnInfo} from "./ColumnInfo.ts";
import {ForeignKeyInfo} from "./ForeignKeyInfo.ts";
import {IndexInfo} from "./IndexInfo.ts";

export interface TableStructure {
	table: string
	primaryKey?: string
	columns: Record<string, ColumnInfo>
	foreignKeys?: ForeignKeyInfo[]
	indexes?: IndexInfo[]
}