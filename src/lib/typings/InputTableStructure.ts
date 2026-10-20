import {TableStructure} from "./TableStructure.ts";
import {InputColumnInfo} from "./InputColumnInfo.ts";

export interface InputTableStructure extends TableStructure {
	columns: Record<string, InputColumnInfo>
}