using Microsoft.AspNetCore.Mvc;
using Soopi.Api.Controllers.Identity;
using Soopi.Api.Data.Entities;
using Soopi.Api.Domain.Identity;
using Soopi.Api.Domain.Shared;
using Soopi.Api.Services.Identity;

namespace Soopi.Tests;

public class AdminHierarchyTests
{
    private readonly AccountPolicy policy = new(null!);
    private static AuthenticatedActor Actor(string username, long id = 1, params Role[] roles) =>
        new(id, username, roles.ToHashSet(), RolePermissions.ForRoles(roles), "NV-TEST", null, username);
    private static Account Employee(params Role[] roles) => Account.Employee("peer", "unchanged", roles, "NV-PEER", false);

    [Theory]
    [InlineData("admin", Role.ADMIN, true)]
    [InlineData("ADMIN", Role.ADMIN, true)]
    [InlineData("other-admin", Role.ADMIN, false)]
    [InlineData("admin", Role.RECEPTIONIST, false)]
    public void Root_RequiresBothDesignatedUsernameAndAdminRole(string username, Role role, bool expected) =>
        Assert.Equal(expected, AccountPolicy.IsRootAdmin(username, [role]));

    [Fact]
    public void Admin_CannotManagePeerOrGrantAdminAndDenialDoesNotMutateTarget()
    {
        var actor = Actor("ordinary-admin", 1, Role.ADMIN);
        var target = Employee(Role.ADMIN, Role.TECHNICIAN);
        var version = target.SecurityVersion;
        Assert.Equal(ErrorCode.ACCESS_DENIED, Assert.Throws<DomainException>(() => policy.RequireCanManage(actor, target)).Code);
        Assert.Equal(ErrorCode.ACCESS_DENIED, Assert.Throws<DomainException>(() => policy.RequireCanAssignRoles(actor, new HashSet<Role> { Role.ADMIN })).Code);
        Assert.Equal("unchanged", target.PasswordHash);
        Assert.Equal(AccountStatus.ACTIVE, target.Status);
        Assert.Equal(version, target.SecurityVersion);
    }

    [Fact]
    public async Task Admin_CannotPromoteStaffDemotePeerOrLockPeer()
    {
        var actor = Actor("ordinary-admin", 1, Role.ADMIN);
        var staff = Employee(Role.TECHNICIAN);
        var peer = Employee(Role.ADMIN);
        var promotion = await Assert.ThrowsAsync<DomainException>(() => policy.RequireCanChangeRolesAsync(actor, staff, new HashSet<Role> { Role.ADMIN }));
        var demotion = await Assert.ThrowsAsync<DomainException>(() => policy.RequireCanChangeRolesAsync(actor, peer, new HashSet<Role> { Role.TECHNICIAN }));
        var locking = await Assert.ThrowsAsync<DomainException>(() => policy.RequireCanLockAsync(actor, peer));
        Assert.All(new[] { promotion, demotion, locking }, error => Assert.Equal(ErrorCode.ACCESS_DENIED, error.Code));
    }

    [Fact]
    public async Task Admin_CanStillManageOrdinaryStaff()
    {
        var actor = Actor("ordinary-admin", 1, Role.ADMIN);
        var staff = Employee(Role.TECHNICIAN);
        policy.RequireCanManage(actor, staff);
        policy.RequireCanAssignRoles(actor, new HashSet<Role> { Role.CASHIER });
        await policy.RequireCanChangeRolesAsync(actor, staff, new HashSet<Role> { Role.CASHIER });
        await policy.RequireCanLockAsync(actor, staff);
    }

    [Fact]
    public async Task Root_CanManagePeerAndPromoteStaffButCannotLockOrDemoteItself()
    {
        var root = Actor("admin", 1, Role.ADMIN);
        var peer = Employee(Role.ADMIN);
        policy.RequireCanManage(root, peer);
        policy.RequireCanAssignRoles(root, new HashSet<Role> { Role.ADMIN });
        await policy.RequireCanChangeRolesAsync(root, Employee(Role.CASHIER), new HashSet<Role> { Role.ADMIN });
        var self = Actor("admin", peer.Id, Role.ADMIN);
        var locking = await Assert.ThrowsAsync<DomainException>(() => policy.RequireCanLockAsync(self, peer));
        var demotion = await Assert.ThrowsAsync<DomainException>(() => policy.RequireCanChangeRolesAsync(self, peer, new HashSet<Role> { Role.CASHIER }));
        Assert.All(new[] { locking, demotion }, error => Assert.Equal(ErrorCode.ACCOUNT_SELF_PROTECTION, error.Code));
    }

    [Fact]
    public void CustomerOperations_RejectEmployeeAndMixedAdminAccounts()
    {
        Assert.Throws<DomainException>(() => AccountPolicy.RequireCustomerAccount(Employee(Role.ADMIN)));
        Assert.Throws<DomainException>(() => AccountPolicy.RequireCustomerAccount(Employee(Role.RECEPTIONIST)));
        var customer = Account.Customer("0900000000", "unchanged", "KH-TEST", false);
        AccountPolicy.RequireCustomerAccount(customer);
        customer.RoleRows.Add(new AccountRole { Role = Role.ADMIN });
        Assert.Throws<DomainException>(() => AccountPolicy.RequireCustomerAccount(customer));
        Assert.Equal("unchanged", customer.PasswordHash);
    }

    [Fact]
    public void AuthView_AdvertisesRootCapabilityOnlyForDesignatedAdministrator()
    {
        Assert.True(AuthService.View(Account.Employee("admin", "hash", [Role.ADMIN], "NV-ROOT", false), "Root").IsRootAdmin);
        Assert.False(AuthService.View(Employee(Role.ADMIN), "Peer").IsRootAdmin);
        Assert.False(AuthService.View(Account.Employee("admin", "hash", [Role.TECHNICIAN], "NV-OTHER", false), "Other").IsRootAdmin);
    }

    [Fact]
    public void EmployeeAdministration_DoesNotExposeHardDeletion() =>
        Assert.DoesNotContain(typeof(AdminEmployeesController).GetMethods(), method => method.IsDefined(typeof(HttpDeleteAttribute), true));
}
