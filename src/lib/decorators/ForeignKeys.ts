import {BackendTable, Class} from "../typings/BackendTable.ts";
import {ForeignKeyInfo} from "../typings/ForeignKeyInfo.ts";

export default function ForeignKeys<T extends BackendTable, TOther extends BackendTable>(column: keyof T, info: Pick<ForeignKeyInfo, "toColumn" | "onDelete" | "onUpdate"> & {toTable: Class<TOther>, toColumn: keyof TOther}) {
	return (table: Class<T>) => {
		const foreignKeys = getForeignKeys(table);
		
		const record = foreignKeys ?? [];
		record.push({
			fromTable: table.name,
			fromColumn: column.toString(),
			toTable: info.toTable.name,
			toColumn: info.toColumn,
			onDelete: info.onDelete,
			onUpdate: info.onUpdate,
		});
		Object.defineProperty(table, foreignKeyPropertyName, {value: record, writable: false});
	}
}

export const foreignKeyPropertyName = "__foreignKey";
export function getForeignKeys<T extends BackendTable>(table: Class<T>): ForeignKeyInfo[] | undefined {
	return (table as never)[foreignKeyPropertyName];
}