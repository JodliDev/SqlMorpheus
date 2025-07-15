import {ColumnInfo} from "./ColumnInfo";
import {ForeignKeyInfo} from "./ForeignKeyInfo";

export interface TableStructure {
	table: string
	primaryKey?: string
	columns: ColumnInfo[]
	foreignKeys?: ForeignKeyInfo[]
}