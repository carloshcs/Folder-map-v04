import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import {
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import notionLogo from '../../../public/assets/notion-logo.png';
import oneDriveLogo from '../../../public/assets/onedrive-logo.png';
import dropboxLogo from '../../../public/assets/dropbox-logo.png';
import googleDriveLogo from '../../../public/assets/google-drive-logo.png';

interface EditMapDialogProps {
  children?: React.ReactNode;
  mapName: string;
  currentIntegrations: string[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onMapNameUpdate?: (oldName: string, newName: string) => void;
}

interface Integration {
  id: string;
  name: string;
  icon: React.ReactNode;
  isConnected: boolean;
  selected: boolean;
}

export function EditMapDialog({
  children,
  mapName: initialMapName,
  currentIntegrations,
  open: controlledOpen,
  onOpenChange,
  onMapNameUpdate
}: EditMapDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [mapName, setMapName] = useState(initialMapName);

  // Reset mapName when dialog opens or initialMapName changes
  useEffect(() => {
    setMapName(initialMapName);
  }, [initialMapName, open]);

  const [isSaving, setIsSaving] = useState(false);
  const [connectingIntegrations, setConnectingIntegrations] =
    useState<Set<string>>(new Set());
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'google-drive',
      name: 'Google Drive',
      icon: (
        <img src={googleDriveLogo.src} alt="Google Drive" className="w-6 h-6" />
      ),
      isConnected: true,
      selected:
        currentIntegrations.includes('Google Drive') ||
        currentIntegrations.includes('Drive')
    },
    {
      id: 'notion',
      name: 'Notion',
      icon: <img src={notionLogo.src} alt="Notion" className="w-6 h-6" />,
      isConnected: true,
      selected: currentIntegrations.includes('Notion')
    },
    {
      id: 'onedrive',
      name: 'OneDrive',
      icon: <img src={oneDriveLogo.src} alt="OneDrive" className="w-6 h-6" />,
      isConnected: false,
      selected: false
    }
  ]);

  const handleIntegrationToggle = (integrationId: string) => {
    setIntegrations(prev =>
      prev.map(integration =>
        integration.id === integrationId && integration.isConnected
          ? { ...integration, selected: !integration.selected }
          : integration
      )
    );
  };

  const handleConnect = (integrationId: string) => {
    const integrationName = integrations.find(
      int => int.id === integrationId
    )?.name;

    setConnectingIntegrations(prev => new Set(prev).add(integrationId));

    setTimeout(() => {
      setIntegrations(prev =>
        prev.map(integration =>
          integration.id === integrationId
            ? { ...integration, isConnected: true }
            : integration
        )
      );

      setConnectingIntegrations(prev => {
        const newSet = new Set(prev);
        newSet.delete(integrationId);
        return newSet;
      });

      toast.success(`Successfully connected to ${integrationName}!`);
    }, 1500);
  };

  const handleSaveMap = async () => {
    setIsSaving(true);

    const selectedIntegrationNames = integrations
      .filter(integration => integration.selected)
      .map(integration => integration.name);

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (mapName !== initialMapName && onMapNameUpdate) {
        onMapNameUpdate(initialMapName, mapName);
      }

      toast.success(`Map "${mapName}" updated successfully!`, {
        description:
          selectedIntegrationNames.length > 0
            ? `Connected to ${selectedIntegrationNames.join(', ')}`
            : undefined
      });

      setOpen(false);
    } catch (error) {
      toast.error('Failed to update map', {
        description:
          'Please try again or contact support if the problem persists.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setMapName(initialMapName);
      setIntegrations(prev =>
        prev.map(integration => ({
          ...integration,
          selected:
            currentIntegrations.includes(integration.name) ||
            (integration.name === 'Google Drive' &&
              currentIntegrations.includes('Drive')) ||
            (integration.name === 'OneDrive' &&
              currentIntegrations.includes('Microsoft'))
        }))
      );
    }
  };

  const isSaveDisabled =
    !mapName.trim() ||
    !integrations.some(integration => integration.selected) ||
    isSaving;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent
        className="
          sm:max-w-[500px]
          bg-white dark:bg-neutral-900 
          border border-neutral-200 dark:border-neutral-700
          shadow-xl rounded-xl
        "
      >
        <DialogHeader>
          <DialogTitle>Edit Map</DialogTitle>
          <DialogDescription>
            Update your map settings including name and selected integrations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Map Name Input */}
          <div className="space-y-2">
            <Label htmlFor="map-name">Map Name</Label>
            <Input
              id="map-name"
              placeholder="Enter a name for your map"
              value={mapName}
              onChange={e => setMapName(e.target.value.slice(0, 25))}
              maxLength={25}
            />
            <div className="text-xs text-muted-foreground text-right">
              {mapName.length}/25 characters
            </div>
          </div>

          {/* Select Integrations */}
          <div className="space-y-3">
            <Label>Select Integrations</Label>
            <div className="space-y-3">
              {integrations.map(integration => (
                <div
                  key={integration.id}
                  className={`
                    border border-border rounded-lg p-4 transition-all cursor-pointer
                    ${
                      integration.selected
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-border/70'
                    }
                    ${!integration.isConnected ? 'opacity-75' : ''}
                  `}
                  onClick={() => handleIntegrationToggle(integration.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {integration.icon}
                      <div>
                        <h4 className="font-medium">{integration.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          {integration.isConnected ? (
                            <Badge
                              variant="default"
                              className="text-xs bg-green-100 text-green-800 hover:bg-green-100"
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Connected
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-yellow-100 text-yellow-800"
                            >
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Not connected
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!integration.isConnected ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={connectingIntegrations.has(integration.id)}
                          onClick={e => {
                            e.stopPropagation();
                            handleConnect(integration.id);
                          }}
                        >
                          {connectingIntegrations.has(integration.id) ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            <>
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Connect Now
                            </>
                          )}
                        </Button>
                      ) : (
                        <div
                          className={`
                            w-5 h-5 rounded border-2 transition-colors
                            ${
                              integration.selected
                                ? 'bg-primary border-primary'
                                : 'border-muted-foreground/30'
                            }
                          `}
                        >
                          {integration.selected && (
                            <CheckCircle className="w-4 h-4 text-primary-foreground" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSaveMap} disabled={isSaveDisabled}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
