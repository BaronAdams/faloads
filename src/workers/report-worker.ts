import { buildCalculationReport } from "@/domain/report";
self.onmessage=(event)=>{try{const {project,selection,author,generatedAt}=event.data;self.postMessage({result:buildCalculationReport(project,selection,author,generatedAt)});}catch(e){self.postMessage({error:e instanceof Error?e.message:"Préparation de la note impossible."});}};
