import {TableClassInterface, Class} from "../../typings/TableClassInterface";
import {getTableInfo, getTableInfoFromMetadata} from "../TableInfo";
import "polyfill-symbol-metadata";
import {ForeignKeyActions} from "../../typings/ForeignKeyInfo";

export default function ForeignKeyToSelf<T extends TableClassInterface>(
	fromColumn: keyof T,
	toColumn: keyof T,
	options?: {
		onUpdate?: ForeignKeyActions,
		onDelete?: ForeignKeyActions,
	},
) {
	return (table: Class<T>, context?: any) => {
		const tableInfo = context?.metadata ? getTableInfoFromMetadata(context.metadata) : getTableInfo(table);
		if(!tableInfo.foreignKeys)
			tableInfo.foreignKeys = [];
		
		tableInfo.foreignKeys.push({
			fromTable: table.name,
			fromColumn: fromColumn.toString(),
			toTable: table.name,
			toColumn: toColumn.toString(),
			onDelete: options?.onDelete,
			onUpdate: options?.onUpdate,
		});
	}
}