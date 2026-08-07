import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import { getCurrentHousehold } from "@/src/lib/data";
import { leaveHousehold } from "@/src/lib/actions";
import {
  forgetDevice,
  getMutedTopics,
  registerDevice,
  setTopicMuted,
} from "@/src/lib/notifications/actions";
import { getHiddenModules, setModuleHidden } from "@/src/lib/modules/actions";
import HouseholdInfo from "@/src/components/household-info";
import ModuleSettings from "@/src/components/modules/module-settings";
import NotificationSettings from "@/src/components/notifications/notification-settings";
import PageHeader from "@/src/components/page-header";
import SignOutButton from "@/src/components/auth/sign-out-button";
import BackButton from "@/src/components/back-button";

export default async function HuisPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const household = await getCurrentHousehold();

  if (!household) {
    redirect("/household-setup");
  }

  const [mutedTopics, hiddenModules] = await Promise.all([getMutedTopics(), getHiddenModules()]);

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader title="Huis" left={<BackButton />} right={<SignOutButton />} />
      <main className="w-full max-w-2xl mx-auto flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <HouseholdInfo
          household={household}
          userId={Number(session.user.id)}
          onLeaveHousehold={leaveHousehold}
        />
        <NotificationSettings
          mutedTopics={mutedTopics}
          onRegisterDevice={registerDevice}
          onForgetDevice={forgetDevice}
          onSetTopicMuted={setTopicMuted}
        />
        <ModuleSettings hiddenModules={hiddenModules} onSetModuleHidden={setModuleHidden} />
      </main>
    </div>
  );
}
