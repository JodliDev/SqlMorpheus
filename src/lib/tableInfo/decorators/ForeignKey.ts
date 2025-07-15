import {BackendTable, Class} from "../../typings/BackendTable";
import {getTableInfoFromMetadata} from "../TableInfo";
import "polyfill-symbol-metadata";
import {ForeignKeyActions} from "../../typings/ForeignKeyInfo"; //Temporary fix. See https://github.com/daomtthuan/polyfill-symbol-metadata#readme

export default function ForeignKey<
	TOther extends BackendTable
>(
	toTable: Class<TOther>,
	toColumn: keyof TOther,
	onDelete?: ForeignKeyActions,
	onUpdate?: ForeignKeyActions,
) {
	return (_: undefined, context: any) => {
		
		const metadata = getTableInfoFromMetadata(context.metadata);
		if(!metadata.foreignKeys)
			metadata.foreignKeys = [];
		
		metadata.foreignKeys.push({
			fromTable: "",
			fromColumn: context.name,
			toTable: toTable.name,
			toColumn: toColumn.toString(),
			onDelete: onDelete,
			onUpdate: onUpdate,
		});
	}
}