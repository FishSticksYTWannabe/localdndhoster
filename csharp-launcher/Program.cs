using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;

namespace LocalDndHosterLauncher
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.WriteLine("Local DND Hoster Launcher");
            Console.WriteLine("1. Start Rust server");
            Console.WriteLine("2. Start Go LAN relay");
            Console.WriteLine("3. Exit");
            Console.Write("Choose an option: ");

            var key = Console.ReadKey();
            Console.WriteLine();

            switch (key.KeyChar)
            {
                case '1':
                    Launch("rust-server", "cargo", "run --manifest-path rust-server/Cargo.toml");
                    break;
                case '2':
                    Launch("go-relay", "go", "run go-relay/main.go");
                    break;
                default:
                    Console.WriteLine("Exiting.");
                    break;
            }
        }

        private static void Launch(string name, string command, string arguments)
        {
            try
            {
                var psi = new ProcessStartInfo(command, arguments)
                {
                    WorkingDirectory = Directory.GetCurrentDirectory(),
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = false
                };

                var process = Process.Start(psi);
                if (process != null)
                {
                    Console.WriteLine($"Launched {name} ({command} {arguments})");
                    process.OutputDataReceived += (sender, e) => Console.WriteLine(e.Data);
                    process.ErrorDataReceived += (sender, e) => Console.WriteLine(e.Data);
                    process.BeginOutputReadLine();
                    process.BeginErrorReadLine();
                    process.WaitForExit();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to launch {name}: {ex.Message}");
            }
        }
    }
}
