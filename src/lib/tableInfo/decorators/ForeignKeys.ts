import {BackendTable, Class} from "../../typings/BackendTable.ts";
import {ForeignKeyInfo} from "../../typings/ForeignKeyInfo.ts";
import {getTableInfo} from "../TableInfo.ts";

export default function ForeignKeys<T extends BackendTable, TOther extends BackendTable>(column: keyof T, info: Pick<ForeignKeyInfo, "toColumn" | "onDelete" | "onUpdate"> & {toTable: Class<TOther>, toColumn: keyof TOther}) {
	return (table: Class<T>) => {
		const tableInfo = getTableInfo(table);
		
		const record = tableInfo.foreignKeys ?? [];
		record.push({
			fromTable: table.name,
			fromColumn: column.toString(),
			toTable: info.toTable.name,
			toColumn: info.toColumn,
			onDelete: info.onDelete,
			onUpdate: info.onUpdate,
		});
		tableInfo.foreignKeys = record;
	}
}