class CreateComplaints < ActiveRecord::Migration[5.1]
  def change
    create_table :complaints do |t|

      t.timestamps
    end
  end
end
