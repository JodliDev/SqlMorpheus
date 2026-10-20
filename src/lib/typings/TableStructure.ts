import {ColumnInfo} from "./ColumnInfo.ts";
import {ForeignKeyInfo} from "./ForeignKeyInfo.ts";

export interface TableStructure {
	table: string
	primaryKey?: string
	columns: Record<string, ColumnInfo>
	foreignKeys?: ForeignKeyInfo[]
}