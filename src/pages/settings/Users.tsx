import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Shield, User as UserIcon, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface UserWithRole {
  id: string;
  email: string | null;
  full_name: string | null;
  roles: AppRole[];
  companies: { id: string; name: string; code: string }[];
}

interface Company {
  id: string;
  name: string;
  code: string;
}

const Users: React.FC = () => {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchCompanies();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Fetch all user companies with company details
      const { data: userCompanies, error: ucError } = await supabase
        .from('user_companies')
        .select('user_id, company_id, companies(id, name, code)');

      if (ucError) throw ucError;

      // Combine data
      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => ({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        roles: (roles || [])
          .filter(r => r.user_id === profile.id)
          .map(r => r.role),
        companies: (userCompanies || [])
          .filter(uc => uc.user_id === profile.id)
          .map(uc => uc.companies as unknown as Company)
          .filter(Boolean),
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, code')
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    try {
      // Remove existing roles
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Add new role
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: newRole });

      if (error) throw error;

      toast.success('Role updated successfully');
      fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    }
  };

  const openAssignDialog = (user: UserWithRole) => {
    setSelectedUser(user);
    setSelectedCompanies(user.companies.map(c => c.id));
    setAssignDialogOpen(true);
  };

  const handleAssignCompanies = async () => {
    if (!selectedUser) return;

    try {
      // Remove existing assignments
      await supabase
        .from('user_companies')
        .delete()
        .eq('user_id', selectedUser.id);

      // Add new assignments
      if (selectedCompanies.length > 0) {
        const { error } = await supabase
          .from('user_companies')
          .insert(
            selectedCompanies.map(companyId => ({
              user_id: selectedUser.id,
              company_id: companyId,
            }))
          );

        if (error) throw error;
      }

      toast.success('Companies assigned successfully');
      setAssignDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Error assigning companies:', error);
      toast.error('Failed to assign companies');
    }
  };

  const toggleCompanySelection = (companyId: string) => {
    setSelectedCompanies(prev =>
      prev.includes(companyId)
        ? prev.filter(id => id !== companyId)
        : [...prev, companyId]
    );
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              You need administrator privileges to access this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage users, roles and company assignments</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="w-5 h-5" />
            All Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No users found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Companies</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.full_name || 'N/A'}
                    </TableCell>
                    <TableCell>{user.email || 'N/A'}</TableCell>
                    <TableCell>
                      <Select
                        value={user.roles[0] || 'user'}
                        onValueChange={(value) => handleRoleChange(user.id, value as AppRole)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4" />
                              Admin
                            </div>
                          </SelectItem>
                          <SelectItem value="user">
                            <div className="flex items-center gap-2">
                              <UserIcon className="w-4 h-4" />
                              User
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.includes('admin') ? (
                          <Badge variant="secondary">All Companies</Badge>
                        ) : user.companies.length > 0 ? (
                          user.companies.slice(0, 2).map(c => (
                            <Badge key={c.id} variant="outline">{c.code}</Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">None</span>
                        )}
                        {!user.roles.includes('admin') && user.companies.length > 2 && (
                          <Badge variant="outline">+{user.companies.length - 2}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {!user.roles.includes('admin') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openAssignDialog(user)}
                        >
                          <Building2 className="w-4 h-4 mr-1" />
                          Assign
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Assign Companies Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Companies to {selectedUser?.full_name || selectedUser?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select which companies this user can access:
            </p>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {companies.map(company => (
                <div
                  key={company.id}
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50"
                >
                  <Checkbox
                    id={company.id}
                    checked={selectedCompanies.includes(company.id)}
                    onCheckedChange={() => toggleCompanySelection(company.id)}
                  />
                  <Label htmlFor={company.id} className="flex-1 cursor-pointer">
                    <span className="font-medium">{company.name}</span>
                    <span className="text-muted-foreground ml-2">({company.code})</span>
                  </Label>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssignCompanies}>
                Save Assignments
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Users;
