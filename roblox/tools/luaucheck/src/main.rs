// Kleiner Luau-Helfer für die Roblox-Tests:
// `luaucheck syntax <dateien..>` übersetzt jede Datei (Syntax-Prüfung),
// `luaucheck run <datei>` führt ein Luau-Skript aus. Es bekommt zwei Extras:
//   loadmodule(pfad [, umgebung]) -> Funktion (Datei laden, optional mit eigener Umgebung)
//   writefile(pfad, text)
use mlua::{Lua, MultiValue};
use std::{env, fs, process};

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 3 {
        eprintln!("usage: luaucheck syntax|run <files..>");
        process::exit(2);
    }
    let lua = Lua::new();
    let mut failed = false;
    match args[1].as_str() {
        "syntax" => {
            for path in &args[2..] {
                let src = fs::read_to_string(path).expect("read");
                match lua.load(&src).set_name(path.as_str()).into_function() {
                    Ok(_) => println!("ok   {path}"),
                    Err(e) => {
                        println!("FAIL {path}\n{e}");
                        failed = true;
                    }
                }
            }
        }
        "run" => {
            let loader = lua
                .create_function(|lua, (path, env): (String, Option<mlua::Table>)| {
                    let src = fs::read_to_string(&path).map_err(mlua::Error::external)?;
                    let mut chunk = lua.load(&src).set_name(path.as_str());
                    if let Some(env) = env {
                        chunk = chunk.set_environment(env);
                    }
                    chunk.into_function()
                })
                .unwrap();
            lua.globals().set("loadmodule", loader).unwrap();
            let writer = lua
                .create_function(|_, (path, content): (String, mlua::String)| {
                    fs::write(&path, content.as_bytes()).map_err(mlua::Error::external)?;
                    Ok(())
                })
                .unwrap();
            lua.globals().set("writefile", writer).unwrap();
            let path = &args[2];
            let src = fs::read_to_string(path).expect("read");
            if let Err(e) = lua.load(&src).set_name(path.as_str()).exec() {
                println!("{e}");
                failed = true;
            }
        }
        _ => {
            eprintln!("unknown mode");
            process::exit(2);
        }
    }
    process::exit(if failed { 1 } else { 0 });
}
