class AddStatusToComplaint < ActiveRecord::Migration[5.1]
  def change
    add_column :complaints, :active, :boolean, default: true
  end
end
