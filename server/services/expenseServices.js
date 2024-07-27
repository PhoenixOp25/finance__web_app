const mongoose = require("mongoose");
const express = require("express");
const User = require("../model/User");
const Authenticate = require("../middleware/authenticate");
const Group = require("../model/Group");
const GroupExpense = require("../model/GroupExpense");

const calculateSplit = (paidBy, members, amount) => {
    const splitAmount = Number((amount / members.length).toFixed(2));
    return members.map(member => {
        const balance = member._id.toString() === paidBy.toString()
            ? amount - splitAmount
            : -splitAmount;
        
        return {
            memberId: member._id,
            name: member.name,
            balance: Number(balance).toFixed(2),
        };
    });
};

const updateMemberBalances = async (expenses, members) => {
    if (!expenses) return [];

    const updatedBalances = expenses.map(({ _id, paidBy, amount }) => ({
        expenseId: _id,
        membersBalance: calculateSplit(paidBy, members, amount),
    }));

    return Promise.all(updatedBalances);
};

const simplifyDebts = (expenses) => {
    const balances = {};

    expenses.forEach(({ payer, amount, participants }) => {
        balances[payer] = (balances[payer] || 0) + amount;
        participants.forEach(participant => {
            balances[participant] = (balances[participant] || 0) - (amount / participants.length);
        });
    });

    const simplifiedDebts = [];

    while (true) {
        const [maxCreditor] = Object.keys(balances).sort((a, b) => balances[b] - balances[a]);
        const [maxDebtor] = Object.keys(balances).sort((a, b) => balances[a] - balances[b]);

        if (balances[maxCreditor] === 0 || Math.abs(balances[maxCreditor]) < 0.01) break;

        const settleAmount = Math.min(Math.abs(balances[maxCreditor]), Math.abs(balances[maxDebtor]));
        balances[maxCreditor] -= settleAmount;
        balances[maxDebtor] += settleAmount;

        simplifiedDebts.push({ from: maxDebtor, to: maxCreditor, amount: settleAmount });
    }

    return simplifiedDebts;
};

module.exports = { calculateSplit, updateMemberBalances, simplifyDebts };
