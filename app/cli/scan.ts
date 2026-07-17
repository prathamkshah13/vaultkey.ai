import fs from "fs"
import scanForSecrets from "../../lib/scanner"  


const targetPath = process.argv[2] //Process.argv is an array that contains everything in the command line. We capture the second argument (Folder path)
// const items = fs.readdirSync(targetPath) //We have an array of file names in the variable items -> Get all the file in the folders 

// console.log(items)
// Writing the loop for reading the file names and reading the content of each file

function scanFolder(folderPath: string){
    const items = fs.readdirSync(folderPath) 
    for (const item of items){
        const fullPath = folderPath + "/" + item
        if (item == "node_modules" || item == ".git" || item == ".next" || item == "dist" || item == "out" || item == "build"){
            continue
        }
        if (fs.statSync(fullPath).isDirectory()){
            scanFolder(fullPath)
        }
        else{
            const content = fs.readFileSync(fullPath, "utf-8")  //-> Now we have the content of the file. 
            const result = scanForSecrets(content) //-> Now we have the result of the scan. 

            if (result.length > 0){
                console.log(fullPath, result) //-> Now we have the full path of the file and the result of the scan.
            }
        }
    }

}



scanFolder(targetPath)
