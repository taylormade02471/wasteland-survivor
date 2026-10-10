/* Android-only behavior layer. It wraps the website bundle without changing
   the main web application source. */
const $ = id => document.getElementById(id);
document.body.classList.add("android-app");

function updateMobileEntryDock() {
  const profileStep = $("profileStep");
  const ready = profileStep
    && !profileStep.classList.contains("hidden")
    && Boolean($("profileName")?.value.trim())
    && Boolean($("profileBirthDate")?.value)
    && /^\d{4}$/.test($("profilePin")?.value.trim() || "");
  document.body.classList.toggle("mobile-profile-ready", Boolean(ready));
}

["profileName", "profileBirthDate", "profilePin"].forEach(id => {
  $(id)?.addEventListener("input", updateMobileEntryDock);
  $(id)?.addEventListener("change", updateMobileEntryDock);
});
$("mobileEntryBtn")?.addEventListener("click", () => $("enterWastlandBtn")?.click());
$("resumeGameBtn")?.replaceChildren(document.createTextNode("Back to Game"));
$("touchAssistStatus")?.replaceChildren(document.createTextNode("AUTO-AIM + AUTO-FIRE"));
$("touchFireBtn")?.replaceChildren(document.createTextNode("Fire"));
$("touchFireBtn")?.setAttribute("aria-label", "Manual Fire");
const androidPrimaryActions = $("touchPrimaryActions");
const androidUtilityTray = $("touchUtilityTray");
const androidReloadButton = $("touchReloadBtn");
const androidInteractButton = $("touchInteractBtn");
if (androidPrimaryActions && androidInteractButton) {
  androidInteractButton.replaceChildren(document.createTextNode("Action"));
  androidInteractButton.setAttribute("aria-label", "Interact with chest or objective");
  androidPrimaryActions.append(androidInteractButton);
}
const androidMenuButton = $("touchUtilityBtn");
if (androidPrimaryActions && androidReloadButton) androidPrimaryActions.append(androidReloadButton);
androidUtilityTray?.classList.add("hidden");
androidUtilityTray?.setAttribute("aria-hidden", "true");
if (androidMenuButton) {
  androidMenuButton.textContent = "Menu";
  androidMenuButton.setAttribute("aria-label", "Open game menu");
  androidMenuButton.onclick = event => {
    event.preventDefault();
    window.dispatchEvent(new Event("android-menu-request"));
  };
}
updateMobileEntryDock();

addEventListener("android-app-paused", () => {
  dispatchEvent(new Event("wasteland:app-paused"));
});
