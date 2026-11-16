//! Explicit WebView2 options: elevated hosts ignore WEBVIEW2_* environment flags.

#[derive(Debug, Default, PartialEq, Eq)]
pub struct WindowsLaunch {
    pub compatibility: bool,
    pub smoke_port: Option<u16>,
}

impl WindowsLaunch {
    pub fn parse(args: &[String], ci: bool) -> Result<Self, String> {
        let mut launch = Self::default();
        for arg in args {
            if arg == "--compatibility" {
                launch.compatibility = true;
            } else if let Some(value) = arg.strip_prefix("--ci-smoke-port=") {
                if !ci {
                    return Err("Le diagnostic automatisé est réservé au runner CI".into());
                }
                let port = value
                    .parse::<u16>()
                    .ok()
                    .filter(|port| *port != 0)
                    .ok_or("Port de diagnostic invalide")?;
                launch.smoke_port = Some(port);
            }
        }
        Ok(launch)
    }

    pub fn browser_args(&self) -> Option<String> {
        if !self.compatibility && self.smoke_port.is_none() {
            return None;
        }
        // additional_browser_args replaces Wry defaults, so preserve them.
        let mut args =
            String::from("--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection");
        if self.compatibility {
            args.push_str(" --disable-gpu");
        }
        if let Some(port) = self.smoke_port {
            args.push_str(&format!(
                " --remote-debugging-address=127.0.0.1 --remote-debugging-port={port}"
            ));
        }
        Some(args)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(args: &[&str], ci: bool) -> Result<WindowsLaunch, String> {
        WindowsLaunch::parse(&args.iter().map(|s| s.to_string()).collect::<Vec<_>>(), ci)
    }

    #[test]
    fn ordinary_launch_does_not_override_webview_or_open_a_debug_port() {
        let launch = parse(&[], false).unwrap();
        assert_eq!(launch.browser_args(), None);
        assert_eq!(launch.smoke_port, None);
    }

    #[test]
    fn compatibility_disables_gpu_without_enabling_remote_debugging() {
        let args = parse(&["--compatibility"], false)
            .unwrap()
            .browser_args()
            .unwrap();
        assert!(args.contains("--disable-gpu"));
        assert!(args.contains("--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection"));
        assert!(!args.contains("remote-debugging"));
    }

    #[test]
    fn ci_can_test_the_release_with_gpu_compatibility_and_loopback_debugging() {
        let launch = parse(&["--ci-smoke-port=9433", "--compatibility"], true).unwrap();
        assert_eq!(launch.smoke_port, Some(9433));
        let args = launch.browser_args().unwrap();
        assert!(args.contains("--remote-debugging-address=127.0.0.1"));
        assert!(args.contains("--remote-debugging-port=9433"));
        assert!(args.contains("--disable-gpu"));
    }

    #[test]
    fn diagnostic_port_requires_ci_and_rejects_invalid_values_and_extra_flags() {
        assert!(parse(&["--ci-smoke-port=9432"], false).is_err());
        for value in ["0", "65536", "-1", "9432 --disable-web-security", ""] {
            assert!(parse(&[&format!("--ci-smoke-port={value}")], true).is_err());
        }
    }
}
