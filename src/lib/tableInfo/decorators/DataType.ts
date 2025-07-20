import {getTableInfo, getTableInfoFromMetadata} from "../TableInfo";
import "polyfill-symbol-metadata"; //Temporary fix. See https://github.com/daomtthuan/polyfill-symbol-metadata#readme
import {DataTypeOptions} from "../DataTypeOptions";

export default function DataType(
	type: DataTypeOptions
) {
	return (table: any, context: any) => {
		
		const metadata = context?.metadata ? getTableInfoFromMetadata(context.metadata) : getTableInfo(table);
		if(!metadata.dataTypes)
			metadata.dataTypes = {};
		
		metadata.dataTypes[context.name ?? context] = type;
	}
}