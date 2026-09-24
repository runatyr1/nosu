import { GroupChatFrame } from '../../components/groups/GroupChatFrame'

/** Keep Armada mounted while its mirrored `/groups/...` URL changes. */
export default function GroupsLayout(): React.ReactNode {
  return <GroupChatFrame />
}
