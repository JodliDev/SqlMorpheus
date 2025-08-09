import {TableStructure} from "./TableStructure";
import {InputColumnInfo} from "./InputColumnInfo";

export interface InputTableStructure extends TableStructure {
	columns: Record<string, InputColumnInfo>
}